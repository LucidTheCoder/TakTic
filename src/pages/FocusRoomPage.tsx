import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  CloudRain,
  Coffee,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  SkipForward,
  Square,
  Timer,
  VolumeX,
  Waves,
} from 'lucide-react';
import { useTakTic } from '../store/TakTicProvider';
import { TakTicLogo } from '../components/brand/TakTicLogo';
import { useAppActions } from '../components/app/AppActionsProvider';
import { useToast } from '../components/ui/ToastProvider';
import { useAmbientSound } from '../hooks/useAmbientSound';
import { playChime, unlockAudio } from '../services/audio';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/Feedback';
import { PriorityBadge, StatusPill } from '../components/ui/Badges';
import { cn } from '../utils/cn';
import {
  formatClock,
  formatDateKey,
  formatTime,
  todayKey,
  toDateKey,
} from '../utils/date';
import { leafTasks, tasksForDate } from '../utils/tasks';
import type { SessionType } from '../types';

const TYPE_LABEL: Record<SessionType, string> = {
  focus: 'Focus',
  short: 'Short break',
  long: 'Long break',
};

export function FocusRoomPage() {
  const { state, stats, dispatch } = useTakTic();
  const { openTask } = useAppActions();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<SessionType>('focus');
  const [quiet, setQuiet] = useState(state.settings.focus.distractionFree);
  const [now, setNow] = useState(Date.now());
  const [confirm, setConfirm] = useState<'reset' | 'end' | 'skip' | null>(null);

  const active = state.activeSession;
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(() => {
    const fromUrl = searchParams.get('task');
    if (fromUrl && state.tasks.some((task) => task.id === fromUrl)) return fromUrl;
    return stats.nextTask?.id ?? null;
  });

  useEffect(() => {
    const fromUrl = searchParams.get('task');
    if (fromUrl && state.tasks.some((task) => task.id === fromUrl)) {
      setSelectedTaskId(fromUrl);
    }
    // Only react to a new deep link; local task choices should not be overwritten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (active?.taskId) setSelectedTaskId(active.taskId);
  }, [active?.taskId]);

  useEffect(() => {
    if (!active) return;
    setTab(active.type);
    const interval = window.setInterval(() => setNow(Date.now()), 400);
    return () => window.clearInterval(interval);
  }, [active?.id, active?.status]);

  useEffect(() => {
    if (!quiet) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [quiet]);

  useAmbientSound(state.settings.focus.ambient);

  const durations: Record<SessionType, number> = {
    focus: state.settings.focus.focusMinutes,
    short: state.settings.focus.shortBreakMinutes,
    long: state.settings.focus.longBreakMinutes,
  };

  const plannedSeconds = active ? active.plannedSeconds : durations[tab] * 60;

  const remainingMs = active
    ? active.status === 'paused'
      ? active.remainingMs ?? 0
      : Math.max(0, active.endsAt - now)
    : plannedSeconds * 1000;

  const percent = active
    ? Math.min(100, Math.max(0, Math.round((1 - remainingMs / (active.plannedSeconds * 1000)) * 100)))
    : 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);

  const selectedTask =
    state.tasks.find((task) => task.id === (active?.taskId ?? selectedTaskId)) ?? null;

  const todaySessions = state.focusSessions.filter(
    (session) => session.type === 'focus' && session.status === 'completed' && toDateKey(session.startTime) === todayKey(),
  );
  const todayMinutes = todaySessions.reduce(
    (sum, session) => sum + Math.round(session.actualSeconds / 60),
    0,
  );
  const cycleTarget = state.settings.focus.sessionsBeforeLongBreak;
  const cycleDone = Math.min(cycleTarget, state.focusCycle);

  const candidateTasks = useMemo(() => {
    const leaves = new Set(leafTasks(state.tasks).map((task) => task.id));
    const todays = tasksForDate(state.tasks, todayKey()).filter(
      (task) => leaves.has(task.id) && task.status !== 'completed',
    );
    const open = stats.openTasks;
    const combined = [...todays, ...open];
    const seen = new Set<string>();
    return combined
      .filter((task) => {
        if (seen.has(task.id) || task.status === 'completed') return false;
        seen.add(task.id);
        return true;
      })
      .slice(0, 8);
  }, [state.tasks, stats.openTasks]);

  const taskSessions = useMemo(
    () =>
      [...state.focusSessions]
        .filter((session) => session.taskId === selectedTask?.id)
        .sort((a, b) => b.startTime.localeCompare(a.startTime))
        .slice(0, 3),
    [state.focusSessions, selectedTask?.id],
  );

  const latestSessions = useMemo(
    () =>
      [...state.focusSessions]
        .sort((a, b) => b.startTime.localeCompare(a.startTime))
        .slice(0, 4),
    [state.focusSessions],
  );

  const startSession = (type: SessionType) => {
    if (active) return;
    unlockAudio();
    if (state.settings.focus.sound) {
      playChime('start', state.settings.focus.soundVolume);
    }
    dispatch({
      type: 'START_SESSION',
      sessionType: type,
      taskId: type === 'focus' ? selectedTaskId : null,
      plannedSeconds: durations[type] * 60,
    });
    setTab(type);
    if (type === 'focus') setQuiet(true);
  };

  const toggleTimer = () => {
    if (!active) {
      startSession(tab);
      return;
    }
    if (active.status === 'paused') dispatch({ type: 'RESUME_SESSION' });
    else dispatch({ type: 'PAUSE_SESSION' });
  };

  const nextAfterSkip = (): { type: SessionType; seconds: number } => {
    if (!active) return { type: 'focus', seconds: durations.focus * 60 };
    if (active.type === 'focus') {
      const nextCycle = state.focusCycle + 1;
      const type: SessionType =
        nextCycle % state.settings.focus.sessionsBeforeLongBreak === 0 ? 'long' : 'short';
      return { type, seconds: durations[type] * 60 };
    }
    return { type: 'focus', seconds: durations.focus * 60 };
  };

  const handleReset = () => {
    dispatch({ type: 'RESET_SESSION' });
    setConfirm(null);
    toast({ title: 'Timer reset', description: 'This session restarted. No XP has changed.', duration: 2600 });
  };

  const handleEnd = () => {
    dispatch({ type: 'END_SESSION' });
    setConfirm(null);
    toast({
      title: 'Session ended',
      description: 'Time is recorded, but no XP is awarded for an unfinished session.',
      duration: 3600,
    });
  };

  const handleSkip = () => {
    const next = nextAfterSkip();
    dispatch({ type: 'END_SESSION' });
    window.setTimeout(() => {
      dispatch({
        type: 'START_SESSION',
        sessionType: next.type,
        taskId: next.type === 'focus' ? selectedTaskId : null,
        plannedSeconds: next.seconds,
      });
      setTab(next.type);
    }, 60);
    setConfirm(null);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && quiet) {
        event.preventDefault();
        setQuiet(false);
        return;
      }
      if (!state.settings.shortcutsEnabled) return;
      if (event.code !== 'Space') return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          'input, textarea, select, button, a, [contenteditable="true"], [role="dialog"]',
        )
      ) {
        return;
      }
      if (document.querySelector('[role="dialog"]')) return;
      if (!state.activeSession) return;
      event.preventDefault();
      toggleTimer();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiet, state.activeSession?.id, state.activeSession?.status, state.settings.shortcutsEnabled]);

  const dial = (
    <TimerDial
      remainingSeconds={remainingSeconds}
      percent={percent}
      type={active?.type ?? tab}
      running={active?.status === 'running'}
      paused={active?.status === 'paused'}
      taskTitle={active && active.type !== 'focus' ? null : selectedTask?.title ?? null}
      plannedMinutes={Math.round(plannedSeconds / 60)}
      large={quiet}
    />
  );

  const controls = (
    <div className="mt-5 flex flex-col items-center gap-3">
      {active ? (
        <>
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="quiet"
              size="icon"
              onClick={() => setConfirm('reset')}
              aria-label="Reset session"
              title="Reset timer"
            >
              <RotateCcw size={14} aria-hidden />
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={toggleTimer}
              className="h-14 w-24 gap-2.5"
              aria-label={active.status === 'paused' ? 'Resume session' : 'Pause session'}
            >
              {active.status === 'paused' ? (
                <>
                  <Play size={17} aria-hidden />
                  Resume
                </>
              ) : (
                <>
                  <Pause size={17} aria-hidden />
                  Pause
                </>
              )}
            </Button>
            <Button
              variant="quiet"
              size="icon"
              onClick={() => setConfirm('skip')}
              aria-label="Skip to the next stage"
              title="Skip this stage"
            >
              <SkipForward size={14} aria-hidden />
            </Button>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setConfirm('end')}
              className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted underline decoration-line underline-offset-4 hover:text-accent"
            >
              <Square size={9} aria-hidden />
              End early
            </button>
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
              {active.status === 'paused' ? 'paused' : 'running'}
            </span>
          </div>
        </>
      ) : (
        <>
          <Button
            variant="primary"
            size="lg"
            onClick={() => startSession(tab)}
            className="h-14 min-w-[230px] rounded-[10px] text-[14px]"
          >
            <Play size={15} aria-hidden />
            Start {tab === 'focus' ? `${durations.focus}-minute focus` : `${durations[tab]}-minute break`}
          </Button>
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
            {state.settings.shortcutsEnabled ? 'Space to start · XP after a complete session' : 'XP after a complete session'}
          </p>
        </>
      )}
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5 sm:pb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[12px] tracking-[0.18em] text-accent">04</span>
            <span className="h-px w-8 bg-accent/35" aria-hidden />
            <span className="eyebrow">Focus room</span>
          </div>
          <h1 className="mt-3 text-[32px] leading-[1.02] sm:text-[44px]">A single block of time.</h1>
          <p className="mt-2 hidden max-w-[520px] text-[15px] leading-7 text-ink/75 sm:block">
            One step at a time. The timer keeps running even if you look away.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/settings#focus"
            className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-line bg-paper px-3 text-[12px] text-muted transition-colors hover:border-ink/25 hover:text-ink"
          >
            <Settings2 size={12} aria-hidden />
            Session settings
          </Link>
          <Button variant="quiet" size="sm" onClick={() => setQuiet(true)}>
            <Maximize2 size={12} aria-hidden />
            Quiet view
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_304px] lg:gap-7">
        <section className="min-w-0">
          <div
            className={cn(
              'relative overflow-hidden rounded-[16px] border border-line bg-paper shadow-paper',
              active && active.type !== 'focus' && 'bg-sage-soft/20',
            )}
          >
            <span
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  'radial-gradient(56% 48% at 50% 38%, rgb(var(--accent) / 0.055), transparent 72%)',
              }}
              aria-hidden
            />
            <div className="relative mx-auto flex max-w-[620px] flex-col items-center px-4 py-5 sm:px-8 sm:py-8">
              <div className="flex w-full border-b border-line" role="tablist" aria-label="Session type">
                {(Object.keys(TYPE_LABEL) as SessionType[]).map((type) => {
                  const isActive = (active?.type ?? tab) === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      disabled={Boolean(active)}
                      onClick={() => setTab(type)}
                      className={cn(
                        'relative flex flex-1 flex-col items-center gap-1 border-b-2 px-2 pb-3 pt-1 transition-colors',
                        isActive
                          ? 'border-accent text-ink'
                          : 'border-transparent text-muted hover:text-ink',
                        active && !isActive && 'opacity-40',
                      )}
                    >
                      <span className="text-[13px] font-medium">{TYPE_LABEL[type]}</span>
                      <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted">
                        {durations[type]} min
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 w-full sm:mt-6">{dial}</div>
              {controls}

              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                {Array.from({ length: cycleTarget }).map((_, index) => (
                  <span
                    key={index}
                    className={cn(
                      'h-[3px] w-5 rounded-full',
                      index < cycleDone ? 'bg-accent' : 'bg-line',
                    )}
                    aria-hidden
                  />
                ))}
                <span className="ml-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                  Cycle {cycleDone}/{cycleTarget} · long break after {cycleTarget}
                </span>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-5 grid max-w-[620px] gap-px overflow-hidden rounded-[12px] border border-line bg-line sm:grid-cols-3">
            <div className="bg-paper px-4 py-3.5">
              <p className="eyebrow mb-1">Today</p>
              <p className="font-mono text-[20px] text-ink">{todayMinutes} min</p>
            </div>
            <div className="bg-paper px-4 py-3.5">
              <p className="eyebrow mb-1">Sessions</p>
              <p className="font-mono text-[20px] text-ink">{todaySessions.length}</p>
            </div>
            <div className="bg-paper px-4 py-3.5">
              <p className="eyebrow mb-1">This week</p>
              <p className="font-mono text-[20px] text-ink">{stats.weekFocusMinutes} min</p>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="border border-line bg-paper p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="eyebrow">Session task</p>
                <h2 className="mt-0.5 text-[15px]">What are you working on?</h2>
              </div>
              <Button variant="ghost" size="icon" aria-label="Create a task" onClick={() => openTask()}>
                +
              </Button>
            </div>
            {candidateTasks.length === 0 ? (
              <EmptyState
                compact
                icon={<Timer size={16} aria-hidden />}
                title="Your first focused session is waiting."
                description="You can focus without attaching a task, or add one first."
                action={
                  <Button size="sm" variant="quiet" onClick={() => openTask()}>
                    Add a task
                  </Button>
                }
              />
            ) : (
              <ul className="mt-3 divide-y divide-line border-t border-line">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTaskId(null);
                      if (active && active.type === 'focus') {
                        dispatch({ type: 'SET_SESSION_TASK', taskId: null });
                      }
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 py-2 text-left text-[13px]',
                      !selectedTaskId ? 'text-accent' : 'text-muted hover:text-ink',
                    )}
                  >
                    <span
                      className={cn(
                        'h-2.5 w-2.5 rounded-full border',
                        !selectedTaskId ? 'border-accent bg-accent' : 'border-line',
                      )}
                      aria-hidden
                    />
                    No task attached
                  </button>
                </li>
                {candidateTasks.map((task) => {
                  const isSelected = task.id === selectedTask?.id;
                  return (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTaskId(task.id);
                          if (active && active.type === 'focus') {
                            dispatch({ type: 'SET_SESSION_TASK', taskId: task.id });
                          }
                        }}
                        className="flex w-full items-start gap-2 py-2 text-left"
                      >
                        <span
                          className={cn(
                            'mt-1 h-2.5 w-2.5 shrink-0 rounded-full border',
                            isSelected ? 'border-accent bg-accent' : 'border-line',
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              'block text-[13px] leading-4',
                              isSelected ? 'text-ink' : 'text-ink/75',
                            )}
                          >
                            {task.title}
                          </span>
                          <span className="mt-0.5 flex items-center gap-2">
                            <PriorityBadge priority={task.priority} />
                            <span className="font-mono text-[10px] text-muted">
                              {task.estimatedMinutes} min
                            </span>
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="border border-line bg-paper p-4">
            <p className="eyebrow">Session ledger</p>
            <h2 className="mt-0.5 text-[15px]">Recorded effort</h2>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <span className="text-[13px] text-muted">Qualifying focus</span>
              <span className="font-mono text-[13px] text-ink">
                +{state.settings.xp.focus} XP each
              </span>
            </div>
            <p className="mt-2 text-[12px] leading-5 text-muted">
              XP is awarded only when the timer completes. Ending early records the time but does
              not award XP.
            </p>
            {latestSessions.length > 0 ? (
              <ul className="mt-3 divide-y divide-line border-t border-line">
                {latestSessions.map((session) => {
                  const task = state.tasks.find((candidate) => candidate.id === session.taskId);
                  return (
                    <li key={session.id} className="flex items-start justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] text-ink/85">
                          {session.type === 'focus' ? task?.title ?? 'Focus block' : TYPE_LABEL[session.type]}
                        </p>
                        <p className="font-mono text-[10px] text-muted">
                          {formatDateKey(toDateKey(session.startTime), { day: 'numeric', month: 'short' })}{' '}
                          · {Math.round(session.actualSeconds / 60)}min
                        </p>
                      </div>
                      <StatusPill tone={session.status === 'completed' ? 'sage' : 'neutral'}>
                        {session.status === 'completed' ? 'done' : 'ended'}
                      </StatusPill>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>

          <section className="border border-line bg-paper p-4">
            <p className="eyebrow">Soundscape</p>
            <h2 className="mt-0.5 text-[15px]">Ambient sound</h2>
            <div className="mt-3 grid grid-cols-3 gap-px bg-line">
              {([
                { value: 'silent', label: 'Silent', icon: VolumeX },
                { value: 'brown', label: 'Brown', icon: Waves },
                { value: 'rain', label: 'Rain', icon: CloudRain },
              ] as const).map((option) => {
                const Icon = option.icon;
                const isActive = state.settings.focus.ambient === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: 'UPDATE_SETTINGS',
                        patch: {
                          focus: {
                            ...state.settings.focus,
                            ambient: option.value,
                          },
                        },
                      })
                    }
                    aria-pressed={isActive}
                    className={cn(
                      'flex flex-col items-center gap-1.5 bg-paper px-2 py-3 text-[12px] transition-colors',
                      isActive ? 'text-accent' : 'text-muted hover:text-ink',
                    )}
                  >
                    <Icon size={15} aria-hidden />
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] leading-4 text-muted">
              Generated locally. Audio begins after a click, and never leaves your device.
            </p>
          </section>

          {selectedTask && taskSessions.length > 0 ? (
            <section className="border border-line bg-paper p-4">
              <p className="eyebrow">Previous sessions</p>
              <h2 className="mt-0.5 line-clamp-1 text-[15px]">{selectedTask.title}</h2>
              <ul className="mt-2 divide-y divide-line border-t border-line">
                {taskSessions.map((session) => (
                  <li key={session.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="font-mono text-[11px] text-muted">
                      {formatDateKey(toDateKey(session.startTime), { day: 'numeric', month: 'short' })}{' '}
                      · {formatTime(session.startTime)}
                    </span>
                    <span className="font-mono text-[11px] text-ink">
                      {Math.round(session.actualSeconds / 60)} / {Math.round(session.plannedSeconds / 60)} min
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="border border-line bg-paper p-4">
            <p className="eyebrow">Session plan</p>
            <div className="mt-2 space-y-1 font-mono text-[12px] text-muted">
              <p className="flex justify-between">
                <span>Focus</span>
                <span className="text-ink">{state.settings.focus.focusMinutes} min</span>
              </p>
              <p className="flex justify-between">
                <span>Short break</span>
                <span className="text-ink">{state.settings.focus.shortBreakMinutes} min</span>
              </p>
              <p className="flex justify-between">
                <span>Long break</span>
                <span className="text-ink">{state.settings.focus.longBreakMinutes} min</span>
              </p>
              <p className="flex justify-between">
                <span>Long break after</span>
                <span className="text-ink">{state.settings.focus.sessionsBeforeLongBreak}</span>
              </p>
            </div>
            <Link
              to="/settings#focus"
              className="mt-3 inline-block text-[12px] text-accent underline decoration-accent/40 underline-offset-2"
            >
              Adjust durations
            </Link>
          </section>
        </aside>
      </div>

      {quiet ? (
        <div
          className="fixed inset-0 z-[85] flex flex-col bg-ivory"
          style={{
            backgroundImage:
              'radial-gradient(60% 48% at 50% 46%, rgb(var(--accent) / 0.06), transparent 72%)',
          }}
        >
          <div className="grain pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative flex items-center justify-between px-5 py-4 sm:px-8">
            <div className="flex min-w-0 items-center gap-2">
              <TakTicLogo
                showTagline={false}
                markClassName="h-6 w-6"
                textClassName="text-[19px]"
              />
              <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                Quiet view
              </span>
            </div>
            <button
              type="button"
              onClick={() => setQuiet(false)}
              className="inline-flex items-center gap-1.5 border border-line bg-paper px-3 py-1.5 text-[12px] text-muted hover:text-ink"
            >
              <Minimize2 size={12} aria-hidden />
              Leave quiet view
            </button>
          </div>
          <div className="relative flex flex-1 flex-col items-center justify-center px-4 pb-16">
            <div className="w-full max-w-[600px]">{dial}</div>
            <div className="mt-6">{controls}</div>
            <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              Esc to leave · Space to pause
            </p>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirm === 'reset'}
        onClose={() => setConfirm(null)}
        onConfirm={handleReset}
        title="Reset the timer?"
        description="The timer restarts from the full duration. Time already spent in this session is discarded and no XP is awarded. Nothing else changes."
        confirmLabel="Reset timer"
        tone="danger"
      />
      <ConfirmDialog
        open={confirm === 'end'}
        onClose={() => setConfirm(null)}
        onConfirm={handleEnd}
        title="End this session early?"
        description="The session is recorded against the task, including the time spent, but an unfinished session earns no XP. You can reopen the focus room at any time."
        confirmLabel="End session"
      />
      <ConfirmDialog
        open={confirm === 'skip'}
        onClose={() => setConfirm(null)}
        onConfirm={handleSkip}
        title="Skip to the next stage?"
        description="The current stage ends early without XP. The next stage — usually a break after focus — begins immediately."
        confirmLabel="Skip ahead"
      />

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 size={10} aria-hidden />
          Timestamp-based timer
        </span>
        <span className="inline-flex items-center gap-1">
          <Coffee size={10} aria-hidden />
          Breaks are never counted as focus
        </span>
        <span className="ml-auto">One session at a time</span>
      </div>
    </div>
  );
}

function TimerDial({
  remainingSeconds,
  percent,
  type,
  running,
  paused,
  taskTitle,
  plannedMinutes,
  large,
}: {
  remainingSeconds: number;
  percent: number;
  type: SessionType;
  running: boolean;
  paused: boolean;
  taskTitle: string | null;
  plannedMinutes: number;
  large: boolean;
}) {
  const radius = 142;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const breakSession = type !== 'focus';

  return (
    <div className={cn('relative mx-auto w-full', large ? 'max-w-[540px]' : 'max-w-[500px]')}>
      {running ? (
        <span
          className={cn(
            'timer-halo pointer-events-none absolute inset-[7%] rounded-full border',
            breakSession ? 'border-sage/30 bg-sage/[0.035]' : 'border-accent/25 bg-accent/[0.025]',
          )}
          aria-hidden
        />
      ) : null}
      <svg viewBox="0 0 320 320" className="relative h-auto w-full" aria-hidden>
        {Array.from({ length: 60 }).map((_, index) => {
          const major = index % 5 === 0;
          return (
            <line
              key={index}
              x1="160"
              y1={major ? 3 : 6}
              x2="160"
              y2={major ? 11 : 9}
              transform={`rotate(${index * 6} 160 160)`}
              stroke="rgb(var(--line))"
              strokeWidth={major ? 1.1 : 0.7}
            />
          );
        })}
        <circle
          cx="160"
          cy="160"
          r={radius}
          fill="none"
          stroke="rgb(var(--line))"
          strokeWidth="1"
        />
        <circle
          cx="160"
          cy="160"
          r="126"
          fill="rgb(var(--paper) / 0.78)"
          stroke="rgb(var(--line) / 0.65)"
          strokeWidth="0.7"
        />
        <circle
          cx="160"
          cy="160"
          r="112"
          fill="none"
          stroke="rgb(var(--line) / 0.45)"
          strokeWidth="0.5"
        />
        <circle
          cx="160"
          cy="160"
          r={radius}
          fill="none"
          stroke={breakSession ? 'rgb(var(--sage))' : 'rgb(var(--accent))'}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 160 160)"
          style={{ transition: 'stroke-dashoffset 0.7s linear' }}
        />
        <circle
          cx="160"
          cy="18"
          r="2.4"
          fill={breakSession ? 'rgb(var(--sage))' : 'rgb(var(--accent))'}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-12 text-center">
        <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
          <span
            className={cn(
              'h-1 w-1 rounded-full',
              running
                ? cn('animate-soft-pulse', breakSession ? 'bg-sage' : 'bg-accent')
                : paused
                  ? 'bg-muted'
                  : 'bg-line',
            )}
            aria-hidden
          />
          {TYPE_LABEL[type]}
        </span>
        <span
          className={cn(
            'mt-2 font-mono leading-none tracking-[-0.06em] text-ink tabular',
            large ? 'text-[78px] sm:text-[94px]' : 'text-[62px] sm:text-[74px]',
          )}
        >
          {formatClock(remainingSeconds)}
        </span>
        <span className="mt-4 font-mono text-[8px] uppercase tracking-[0.18em] text-muted/70">
          {taskTitle ? 'Working on' : breakSession ? 'Break' : 'Session'}
        </span>
        <span className="mt-1 line-clamp-2 max-w-[250px] text-[13px] leading-5 text-ink/75">
          {taskTitle ?? (breakSession ? 'Step away from the desk.' : 'No task attached')}
        </span>
        <span className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted/70">
          {plannedMinutes} minute block
        </span>
      </div>
    </div>
  );
}
