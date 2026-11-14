import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { TakTicState } from '../types';
import { createInitialState } from '../data/initialState';
import { defaultSettings } from '../services/gamification/xp';
import { loadState, saveState } from '../services/storage/storage';
import { prepareState } from '../services/storage/repair';
import { reducer, type Action } from './reducer';
import { derive, type DerivedStats } from './selectors';
import { useToast } from '../components/ui/ToastProvider';
import { playChime, unlockAudio } from '../services/audio';
import {
  browserNotificationsSupported,
  sendBrowserNotification,
} from '../services/notifications';
import { ACHIEVEMENTS } from '../services/gamification/achievements';
import { toDateKey, todayKey } from '../utils/date';

const LEGACY_DASHBOARD_ORDER = [
  'dailyProgress',
  'progression',
  'todayTasks',
  'objectives',
  'activeProjects',
  'deadlines',
  'focusStats',
  'recentAchievements',
  'companionNote',
];

/**
 * Moves only untouched old defaults onto the new Matcha, four-panel default.
 * Explicit dashboard arrangements and chosen accents are never overwritten.
 */
function migrateLegacyDefaults(state: TakTicState): TakTicState {
  const dashboard = state.settings.dashboard;
  const needsDashboardMigration =
    !dashboard.customized &&
    dashboard.hidden.length === 0 &&
    dashboard.order.join('|') === LEGACY_DASHBOARD_ORDER.join('|');
  const needsAccentMigration =
    !state.profile.preferences.accentChanged &&
    state.profile.preferences.accent === 'vermilion';
  if (!needsDashboardMigration && !needsAccentMigration) return state;

  const defaults = defaultSettings().dashboard;
  return {
    ...state,
    profile: needsAccentMigration
      ? {
          ...state.profile,
          preferences: {
            ...state.profile.preferences,
            accent: 'matcha',
            accentChanged: false,
          },
        }
      : state.profile,
    settings: needsDashboardMigration
      ? {
          ...state.settings,
          dashboard: { order: defaults.order, hidden: defaults.hidden, customized: false },
        }
      : state.settings,
  };
}

const BULK_STATE_ACTIONS: ReadonlySet<Action['type']> = new Set([
  'LOAD_DEMO',
  'REMOVE_DEMO',
  'RESET',
  'IMPORT_STATE',
  'RESTORE_STATE',
]);

interface TakTicContextValue {
  state: TakTicState;
  dispatch: Dispatch<Action>;
  stats: DerivedStats;
  levelUp: number | null;
  dismissLevelUp: () => void;
  captureSnapshot: () => TakTicState;
  offerUndo: (label: string, snapshot: TakTicState, description?: string) => void;
}

const TakTicContext = createContext<TakTicContextValue | null>(null);

export function TakTicProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [initial] = useState<{ state: TakTicState; error: string | null }>(() => {
    const loaded = loadState();
    return {
      state: loaded.state ? migrateLegacyDefaults(prepareState(loaded.state)) : createInitialState(),
      error: loaded.error,
    };
  });
  const [state, rawDispatch] = useReducer(reducer, initial.state);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const feedbackSuppressedUntil = useRef(0);

  const dispatch = useCallback<Dispatch<Action>>((action) => {
    if (BULK_STATE_ACTIONS.has(action.type)) {
      feedbackSuppressedUntil.current = Date.now() + 1500;
    }
    rawDispatch(action);
  }, []);

  const stats = useMemo(() => derive(state), [state]);
  const stateRef = useRef(state);
  stateRef.current = state;

  const seenTransactions = useRef<Set<string>>(
    new Set(initial.state.xpTransactions.map((transaction) => transaction.id)),
  );
  const seenAchievements = useRef<Set<string>>(
    new Set(initial.state.achievements.map((achievement) => achievement.id)),
  );
  const previousLevel = useRef(stats.level.level);
  const remindedDeadlines = useRef<Set<string>>(new Set());
  const chimeGuard = useRef<string | null>(null);
  const seenReviewNotification = useRef<string | null>(null);
  const saveErrorShown = useRef(false);

  // A user gesture is required before any browser audio can play.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    if (initial.error) {
      toast({
        title: 'Saved data could not be loaded',
        description: `${initial.error} Starting with a clean workspace.`,
        tone: 'error',
        duration: 9000,
      });
    }
  }, [initial.error, toast]);

  // Persist and report failures once.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const saved = saveState({ ...state, lastSavedAt: new Date().toISOString() });
      if (!saved && !saveErrorShown.current) {
        saveErrorShown.current = true;
        toast({
          title: 'Could not save locally',
          description: 'Browser storage may be full or unavailable. Export your data from Settings.',
          tone: 'error',
          duration: 9000,
        });
      }
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [state, toast]);

  // Keep the day boundary honest without reloading the page.
  useEffect(() => {
    const checkDay = () => {
      if (stateRef.current.objectivesDate !== todayKey()) {
        rawDispatch({ type: 'REFRESH_DAY' });
      }
    };
    const interval = window.setInterval(checkDay, 30_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkDay();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Finish sessions using timestamps, even after sleep or a refresh.
  const activeSession = state.activeSession;
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'running') return;
    const check = () => {
      if (Date.now() + 250 < activeSession.endsAt) return;
      if (chimeGuard.current !== activeSession.id) {
        chimeGuard.current = activeSession.id;
        if (stateRef.current.settings.focus.sound) {
          playChime(
            activeSession.type === 'focus' ? 'focus' : 'break',
            stateRef.current.settings.focus.soundVolume,
          );
        }
        const session = stateRef.current.activeSession;
        if (session) {
          if (
            session.type !== 'focus' &&
            stateRef.current.settings.notifications.browser &&
            stateRef.current.settings.notifications.focus &&
            browserNotificationsSupported()
          ) {
            sendBrowserNotification('Break finished', 'Ready for another step when you are.');
          }
        }
      }
      rawDispatch({ type: 'COMPLETE_SESSION' });
    };
    check();
    const interval = window.setInterval(check, 1000);
    return () => window.clearInterval(interval);
  }, [activeSession?.id, activeSession?.endsAt, activeSession?.status]);

  // XP feedback for events generated by this session (not imported history).
  useEffect(() => {
    const newTransactions = state.xpTransactions.filter(
      (transaction) => !seenTransactions.current.has(transaction.id),
    );
    newTransactions.forEach((transaction) => seenTransactions.current.add(transaction.id));
    if (newTransactions.length === 0) return;
    if (Date.now() < feedbackSuppressedUntil.current) return;
    const recent = newTransactions.filter(
      (transaction) =>
        Date.now() - new Date(transaction.timestamp).getTime() < 15_000 &&
        !transaction.source.startsWith('achievement:') &&
        !transaction.source.startsWith('objective:'),
    );
    if (recent.length === 0) return;
    const total = recent.reduce((sum, transaction) => sum + transaction.amount, 0);
    if (total <= 0) return;
    if (
      stateRef.current.settings.focus.sound &&
      recent.some((transaction) => transaction.source.startsWith('task:'))
    ) {
      playChime('task', stateRef.current.settings.focus.soundVolume);
    }
    toast({
      title: `+${total} XP`,
      description:
        recent.length === 1
          ? recent[0].label ?? 'Progress recorded'
          : `${recent.length} progress updates recorded`,
      tone: 'xp',
      duration: 3200,
    });
  }, [state.xpTransactions, toast]);

  useEffect(() => {
    const newUnlocks = state.achievements.filter(
      (achievement) => !seenAchievements.current.has(achievement.id),
    );
    newUnlocks.forEach((achievement) => seenAchievements.current.add(achievement.id));
    if (Date.now() < feedbackSuppressedUntil.current) return;
    for (const unlock of newUnlocks) {
      const definition = ACHIEVEMENTS.find((item) => item.id === unlock.id);
      if (!definition) continue;
      if (Date.now() - new Date(unlock.unlockedAt).getTime() > 15_000) continue;
      if (stateRef.current.settings.focus.sound) {
        playChime('achievement', stateRef.current.settings.focus.soundVolume);
      }
      if (
        state.settings.notifications.inApp &&
        state.settings.notifications.achievements
      ) {
        toast({
          title: `Achievement — ${definition.name}`,
          description: `${definition.description} +${definition.xpReward} XP`,
          tone: 'success',
          duration: 5200,
        });
      }
      if (
        state.settings.notifications.browser &&
        state.settings.notifications.achievements
      ) {
        sendBrowserNotification(
          `Achievement unlocked — ${definition.name}`,
          definition.description,
        );
      }
    }
  }, [state.achievements, state.settings.notifications, toast]);

  useEffect(() => {
    if (Date.now() < feedbackSuppressedUntil.current) {
      previousLevel.current = stats.level.level;
      return undefined;
    }
    if (stats.level.level > previousLevel.current) {
      setLevelUp(stats.level.level);
      previousLevel.current = stats.level.level;
      const timeout = window.setTimeout(() => setLevelUp(null), 4200);
      return () => window.clearTimeout(timeout);
    }
    previousLevel.current = stats.level.level;
    return undefined;
  }, [stats.level.level]);

  // Deadline reminders, once per task per session, never guilt-based.
  useEffect(() => {
    if (!state.settings.notifications.inApp || !state.settings.notifications.deadlines) return;
    const dueSoon = state.tasks.filter((task) => {
      if (task.status === 'completed' || !task.deadline) return false;
      if (state.tasks.some((child) => child.parentTaskId === task.id)) return false;
      const diff = new Date(task.deadline).getTime() - Date.now();
      return diff > 0 && diff < 24 * 60 * 60 * 1000;
    });
    const unseen = dueSoon.filter((task) => !remindedDeadlines.current.has(task.id));
    if (unseen.length === 0) return;
    unseen.forEach((task) => remindedDeadlines.current.add(task.id));
    const names = unseen.slice(0, 2).map((task) => task.title).join(' · ');
    toast({
      title: unseen.length === 1 ? 'A deadline is close' : `${unseen.length} deadlines are close`,
      description: names,
      tone: 'default',
      duration: 6000,
    });
    if (state.settings.notifications.browser) {
      sendBrowserNotification(
        'Deadline approaching',
        unseen.length === 1 ? `${unseen[0].title} is due within 24 hours.` : names,
      );
    }
  }, [state.tasks, state.settings.notifications, toast]);

  // A single browser notification when a focus review is waiting.
  useEffect(() => {
    const reviewId = state.pendingReviewSessionId;
    if (!reviewId || seenReviewNotification.current === reviewId) return;
    seenReviewNotification.current = reviewId;
    const session = state.focusSessions.find((candidate) => candidate.id === reviewId);
    if (!session || session.type !== 'focus') return;
    if (
      state.settings.notifications.browser &&
      state.settings.notifications.focus &&
      browserNotificationsSupported()
    ) {
      sendBrowserNotification(
        'Focus session complete',
        'Take a moment to note what you accomplished.',
      );
    }
  }, [state.pendingReviewSessionId, state.focusSessions, state.settings.notifications]);

  const captureSnapshot = useCallback(() => stateRef.current, []);

  const offerUndo = useCallback(
    (label: string, snapshot: TakTicState, description?: string) => {
      toast({
        title: label,
        description: description ?? 'This action can be undone.',
        tone: 'default',
        duration: 8000,
        action: {
          label: 'Undo',
          onClick: () => dispatch({ type: 'RESTORE_STATE', state: snapshot }),
        },
      });
    },
    [toast],
  );

  const dismissLevelUp = useCallback(() => setLevelUp(null), []);

  const value = useMemo<TakTicContextValue>(
    () => ({
      state,
      dispatch,
      stats,
      levelUp,
      dismissLevelUp,
      captureSnapshot,
      offerUndo,
    }),
    [state, dispatch, stats, levelUp, dismissLevelUp, captureSnapshot, offerUndo],
  );

  return <TakTicContext.Provider value={value}>{children}</TakTicContext.Provider>;
}

export function useTakTic(): TakTicContextValue {
  const context = useContext(TakTicContext);
  if (!context) {
    throw new Error('useTakTic must be used inside TakTicProvider.');
  }
  return context;
}

export { toDateKey };
