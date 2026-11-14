let context: AudioContext | null = null;

export type ChimeKind = 'start' | 'focus' | 'break' | 'task' | 'achievement' | 'test';

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!context) {
      const Ctor = window.AudioContext;
      if (!Ctor) return null;
      context = new Ctor();
    }
    return context;
  } catch {
    return null;
  }
}

/**
 * Browsers keep a new AudioContext suspended until a real gesture. Creating a
 * silent one-second buffer on the first click or key press makes later timers
 * and task sounds reliable, even after the tab has been idle for a long time.
 */
export function unlockAudio(): boolean {
  const audioContext = getContext();
  if (!audioContext) return false;
  if (audioContext.state === 'suspended') {
    void audioContext.resume().catch(() => undefined);
  }
  try {
    const buffer = audioContext.createBuffer(1, 1, 22050);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
    source.stop(audioContext.currentTime + 0.01);
  } catch {
    // The next gesture will try again.
  }
  return audioContext.state !== 'closed';
}

const CHIMES: Record<ChimeKind, Array<{ frequency: number; start: number; duration: number }>> = {
  start: [
    { frequency: 440, start: 0, duration: 0.28 },
    { frequency: 660, start: 0.1, duration: 0.38 },
  ],
  focus: [
    { frequency: 660, start: 0, duration: 0.5 },
    { frequency: 880, start: 0.16, duration: 0.7 },
  ],
  break: [
    { frequency: 660, start: 0, duration: 0.42 },
    { frequency: 523, start: 0.15, duration: 0.58 },
  ],
  task: [
    { frequency: 740, start: 0, duration: 0.28 },
    { frequency: 988, start: 0.09, duration: 0.42 },
  ],
  achievement: [
    { frequency: 659, start: 0, duration: 0.34 },
    { frequency: 784, start: 0.12, duration: 0.4 },
    { frequency: 988, start: 0.24, duration: 0.62 },
  ],
  test: [
    { frequency: 660, start: 0, duration: 0.45 },
    { frequency: 880, start: 0.14, duration: 0.6 },
  ],
};

/** A quiet chime written for TakTic. No audio files, so nothing can 404. */
export function playChime(kind: ChimeKind = 'focus', volume = 0.12): void {
  const audioContext = getContext();
  if (!audioContext) return;
  const level = Math.max(0, Math.min(1, volume));
  if (level === 0) return;
  if (audioContext.state === 'suspended') {
    void audioContext.resume().catch(() => undefined);
  }
  try {
    const now = audioContext.currentTime;
    const notes = CHIMES[kind];
    for (const note of notes) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = note.frequency;
      gain.gain.setValueAtTime(0, now + note.start);
      gain.gain.linearRampToValueAtTime(level * 0.16, now + note.start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(now + note.start);
      oscillator.stop(now + note.start + note.duration + 0.05);
    }
  } catch {
    // Sound is optional.
  }
}

export interface AmbientHandle {
  stop: () => void;
  setVolume: (value: number) => void;
}

/**
 * Looping generative ambience built from shaped noise. These are original
 * synthesized sounds, so there are no licensing concerns.
 */
export function startAmbient(kind: 'brown' | 'rain'): AmbientHandle | null {
  const audioContext = getContext();
  if (!audioContext) return null;
  try {
    const bufferSize = audioContext.sampleRate * 4;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const channel = buffer.getChannelData(0);
    let lastOut = 0;
    for (let index = 0; index < bufferSize; index += 1) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      channel[index] = lastOut * 3.2;
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const master = audioContext.createGain();
    master.gain.value = 0;

    if (kind === 'rain') {
      const highpass = audioContext.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 900;
      const lowpass = audioContext.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 6000;
      const lfo = audioContext.createOscillator();
      lfo.frequency.value = 0.14;
      const lfoGain = audioContext.createGain();
      lfoGain.gain.value = 0.05;
      lfo.connect(lfoGain);
      lfoGain.connect(master.gain);
      source.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(master);
      lfo.start();
      source.start();
      master.gain.linearRampToValueAtTime(0.16, audioContext.currentTime + 1.2);
      return {
        stop: () => {
          try {
            source.stop();
            lfo.stop();
            master.disconnect();
          } catch {
            // Already stopped.
          }
        },
        setVolume: (value: number) => {
          master.gain.setTargetAtTime(Math.max(0, value) * 0.3, audioContext.currentTime, 0.2);
        },
      };
    }

    const lowpass = audioContext.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 700;
    source.connect(lowpass);
    lowpass.connect(master);
    source.start();
    master.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 1.5);

    return {
      stop: () => {
        try {
          source.stop();
          master.disconnect();
        } catch {
          // Already stopped.
        }
      },
      setVolume: (value: number) => {
        master.gain.setTargetAtTime(Math.max(0, value) * 0.35, audioContext.currentTime, 0.2);
      },
    };
  } catch {
    return null;
  }
}
