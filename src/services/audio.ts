let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!context) {
      const Ctor = window.AudioContext;
      if (!Ctor) return null;
      context = new Ctor();
    }
    if (context.state === 'suspended') {
      void context.resume();
    }
    return context;
  } catch {
    return null;
  }
}

/** A quiet two-note chime written for TakTic (no external audio files). */
export function playChime(volume = 0.12): void {
  const audioContext = getContext();
  if (!audioContext) return;
  try {
    const now = audioContext.currentTime;
    const notes = [
      { frequency: 660, start: 0, duration: 0.5 },
      { frequency: 880, start: 0.16, duration: 0.7 },
    ];
    for (const note of notes) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = note.frequency;
      gain.gain.setValueAtTime(0, now + note.start);
      gain.gain.linearRampToValueAtTime(volume, now + note.start + 0.03);
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
