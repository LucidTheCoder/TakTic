import { z } from 'zod';
import type { AppSettings, TakTicState } from '../../types';
import { defaultSettings } from '../gamification/xp';

export const SCHEMA_VERSION = 1;
const STORAGE_KEY = 'taktic.state.v1';
const BACKUP_PREFIX = 'taktic.backup.';

const isoString = z.string().min(1);
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const priority = z.enum(['low', 'medium', 'high', 'urgent']);
const difficulty = z.enum(['easy', 'medium', 'hard']);

export const TaskSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  parentTaskId: z.string().nullable(),
  title: z.string().min(1),
  description: z.string().default(''),
  estimatedMinutes: z.number().finite().nonnegative(),
  actualMinutes: z.number().finite().nonnegative().default(0),
  difficulty,
  priority,
  xpReward: z.number().finite().nonnegative(),
  status: z.enum(['todo', 'in_progress', 'blocked', 'completed']),
  deadline: isoString.nullable(),
  deadlineHasTime: z.boolean().default(false),
  scheduledDate: dateKey.nullable().default(null),
  dependencies: z.array(z.string()).default([]),
  blockedReason: z.string().nullable().default(null),
  childTaskIds: z.array(z.string()).default([]),
  createdAt: isoString,
  completedAt: isoString.nullable(),
  order: z.number().finite().default(0),
  lastAdaptedAt: z.string().nullable().optional(),
  isDemo: z.boolean().optional(),
});

export const ProjectSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  deadline: isoString.nullable(),
  priority,
  status: z.enum(['active', 'completed', 'archived']),
  createdAt: isoString,
  updatedAt: isoString,
  completedAt: isoString.nullable(),
  isDemo: z.boolean().optional(),
});

export const FocusSessionSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().nullable(),
  type: z.enum(['focus', 'short', 'long']),
  plannedSeconds: z.number().finite().nonnegative(),
  actualSeconds: z.number().finite().nonnegative(),
  startTime: isoString,
  endTime: isoString,
  status: z.enum(['completed', 'abandoned']),
  xpAwarded: z.boolean().default(false),
  notes: z.string().optional(),
  isDemo: z.boolean().optional(),
});

const AchievementUnlockSchema = z.object({
  id: z.string().min(1),
  unlockedAt: isoString,
  isDemo: z.boolean().optional(),
});

const XpTransactionSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  amount: z.number().finite().nonnegative(),
  timestamp: isoString,
  label: z.string().optional(),
  isDemo: z.boolean().optional(),
});

const DailyObjectiveSchema = z.object({
  id: z.string().min(1),
  date: dateKey,
  kind: z.enum(['tasks', 'focus', 'project']),
  description: z.string().min(1),
  target: z.number().finite().positive(),
  currentProgress: z.number().finite().nonnegative(),
  completed: z.boolean(),
  xpReward: z.number().finite().nonnegative(),
  projectId: z.string().optional(),
});

const AdaptationSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  feedbackType: z.enum(['understand', 'start', 'too_big', 'concentration', 'time', 'resources', 'other']),
  userExplanation: z.string().default(''),
  generatedTasks: z.array(z.string()).default([]),
  reasoning: z.string().default(''),
  createdAt: isoString,
  isDemo: z.boolean().optional(),
});

const ActivityDaySchema = z.object({
  date: dateKey,
  tasks: z.number().finite().nonnegative(),
  focusMinutes: z.number().finite().nonnegative(),
});

const StreakSchema = z.object({
  currentStreak: z.number().finite().nonnegative(),
  longestStreak: z.number().finite().nonnegative(),
  totalActiveDays: z.number().finite().nonnegative(),
  lastActiveDate: dateKey.nullable(),
  activityDates: z.array(ActivityDaySchema).default([]),
});

const PlanBlockSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['focus', 'break', 'longBreak']),
  start: isoString,
  end: isoString,
  taskId: z.string().nullable(),
  label: z.string(),
  minutes: z.number().finite().nonnegative(),
});

const DailyPlanSchema = z.object({
  id: z.string().min(1),
  date: dateKey,
  startTime: z.string(),
  availableMinutes: z.number().finite().positive(),
  blocks: z.array(PlanBlockSchema),
  summary: z.string(),
  source: z.enum(['ai', 'rule-based']),
  createdAt: isoString,
});

const CompanionMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  createdAt: isoString,
  suggestions: z
    .array(z.object({ label: z.string(), taskId: z.string().optional() }))
    .optional(),
  isError: z.boolean().optional(),
  isDemo: z.boolean().optional(),
});

const ActiveSessionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['focus', 'short', 'long']),
  taskId: z.string().nullable(),
  plannedSeconds: z.number().finite().positive(),
  startedAt: z.number().finite(),
  endsAt: z.number().finite(),
  remainingMs: z.number().finite().nullable(),
  status: z.enum(['running', 'paused']),
  focusCycleBefore: z.number().finite().nonnegative(),
});

const ProfileSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  avatar: z.string().max(4).optional(),
  level: z.number().finite().positive(),
  xp: z.number().finite().nonnegative(),
  createdAt: isoString,
  preferences: z.object({
    theme: z.enum(['light', 'dark']),
    accent: z.enum(['vermilion', 'indigo', 'matcha', 'ochre']),
    reducedMotion: z.boolean(),
  }),
});

const defaults = defaultSettings();

const FocusSettingsSchema = z.object({
  focusMinutes: z.number().min(1).max(180).default(defaults.focus.focusMinutes),
  shortBreakMinutes: z.number().min(1).max(60).default(defaults.focus.shortBreakMinutes),
  longBreakMinutes: z.number().min(1).max(90).default(defaults.focus.longBreakMinutes),
  sessionsBeforeLongBreak: z.number().min(1).max(12).default(defaults.focus.sessionsBeforeLongBreak),
  autoStartBreaks: z.boolean().default(defaults.focus.autoStartBreaks),
  sound: z.boolean().default(defaults.focus.sound),
  ambient: z.enum(['silent', 'brown', 'rain']).default(defaults.focus.ambient),
  distractionFree: z.boolean().default(defaults.focus.distractionFree),
});

const AiSettingsSchema = z.object({
  apiKey: z.string().default(''),
  model: z.string().default(defaults.ai.model),
  companionStyle: z.enum(['concise', 'warm', 'direct']).default(defaults.ai.companionStyle),
});

const NotificationSettingsSchema = z.object({
  inApp: z.boolean().default(defaults.notifications.inApp),
  browser: z.boolean().default(defaults.notifications.browser),
  deadlines: z.boolean().default(defaults.notifications.deadlines),
  focus: z.boolean().default(defaults.notifications.focus),
  achievements: z.boolean().default(defaults.notifications.achievements),
  objectives: z.boolean().default(defaults.notifications.objectives),
});

const XpConfigSchema = z.object({
  easy: z.number().nonnegative().default(defaults.xp.easy),
  medium: z.number().nonnegative().default(defaults.xp.medium),
  hard: z.number().nonnegative().default(defaults.xp.hard),
  focus: z.number().nonnegative().default(defaults.xp.focus),
  objective: z.number().nonnegative().default(defaults.xp.objective),
  project: z.number().nonnegative().default(defaults.xp.project),
});

const widgetId = z.enum([
  'dailyProgress',
  'progression',
  'todayTasks',
  'activeProjects',
  'objectives',
  'deadlines',
  'focusStats',
  'recentAchievements',
  'companionNote',
]);

const SettingsSchema = z.object({
  focus: FocusSettingsSchema.default(defaults.focus),
  ai: AiSettingsSchema.default(defaults.ai),
  notifications: NotificationSettingsSchema.default(defaults.notifications),
  dashboard: z
    .object({
      order: z.array(widgetId).default(defaults.dashboard.order),
      hidden: z.array(widgetId).default(defaults.dashboard.hidden),
    })
    .default(defaults.dashboard),
  shortcutsEnabled: z.boolean().default(defaults.shortcutsEnabled),
  xp: XpConfigSchema.default(defaults.xp),
  planner: z
    .object({
      availableMinutes: z.number().min(15).max(720).default(defaults.planner.availableMinutes),
      startHour: z.number().min(0).max(23).default(defaults.planner.startHour),
      focusMinutes: z.number().min(5).max(90).default(defaults.planner.focusMinutes),
    })
    .default(defaults.planner),
});

export const StateSchema = z.object({
  version: z.number().int().min(1),
  profile: ProfileSchema,
  settings: SettingsSchema,
  projects: z.array(ProjectSchema),
  tasks: z.array(TaskSchema),
  focusSessions: z.array(FocusSessionSchema),
  achievements: z.array(AchievementUnlockSchema),
  xpTransactions: z.array(XpTransactionSchema),
  objectives: z.array(DailyObjectiveSchema),
  objectivesDate: dateKey,
  adaptations: z.array(AdaptationSchema),
  streak: StreakSchema,
  dailyPlans: z.array(DailyPlanSchema),
  activeSession: ActiveSessionSchema.nullable(),
  focusCycle: z.number().finite().nonnegative(),
  pendingReviewSessionId: z.string().nullable(),
  companionMessages: z.array(CompanionMessageSchema),
  demoLoaded: z.boolean(),
  lastSavedAt: isoString.nullable(),
});

export type StateParseResult =
  | { ok: true; state: TakTicState }
  | { ok: false; error: string };

function formatZodError(error: z.ZodError): string {
  const first = error.issues[0];
  if (!first) return 'The data is not a valid TakTic backup.';
  return `Invalid data at ${first.path.join('.') || 'root'}: ${first.message}`;
}

export function mergeSettings(input: unknown): AppSettings {
  const parsed = SettingsSchema.safeParse(input ?? {});
  if (!parsed.success) return defaults;

  // Migrate the original default to the zero-cost Free Models Router.
  if (parsed.data.ai.model === 'google/gemini-2.5-flash') {
    return {
      ...parsed.data,
      ai: { ...parsed.data.ai, model: defaults.ai.model },
    };
  }

  return parsed.data;
}

export function normalizeState(input: unknown): StateParseResult {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'The file does not contain a TakTic backup.' };
  }
  const candidate = input as Record<string, unknown>;
  const normalized = {
    ...candidate,
    version: SCHEMA_VERSION,
    settings: mergeSettings(candidate.settings),
  };
  const parsed = StateSchema.safeParse(normalized);
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }
  return { ok: true, state: parsed.data as TakTicState };
}

export function loadState(): { state: TakTicState | null; error: string | null } {
  if (typeof window === 'undefined') return { state: null, error: null };
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return { state: null, error: 'Local storage is unavailable in this browser.' };
  }
  if (!raw) return { state: null, error: null };
  try {
    const parsed = JSON.parse(raw);
    const result = normalizeState(parsed);
    if (!result.ok) {
      backupCorrupt(raw);
      return { state: null, error: result.error };
    }
    return { state: result.state, error: null };
  } catch {
    backupCorrupt(raw);
    return { state: null, error: 'Saved data could not be read. A backup was kept locally.' };
  }
}

function backupCorrupt(raw: string): void {
  try {
    const key = `${BACKUP_PREFIX}${Date.now()}`;
    window.localStorage.setItem(key, raw);
    const keys = Object.keys(window.localStorage).filter((item) => item.startsWith(BACKUP_PREFIX));
    keys
      .sort()
      .slice(0, Math.max(0, keys.length - 1))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // A failed backup must never block the app from loading.
  }
}

export function saveState(state: TakTicState): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures on reset; the in-memory state is still cleared.
  }
}

export function exportPayload(state: TakTicState): string {
  return JSON.stringify(
    {
      app: 'TakTic',
      exportedAt: new Date().toISOString(),
      version: SCHEMA_VERSION,
      state: { ...state, lastSavedAt: new Date().toISOString() },
    },
    null,
    2,
  );
}

export function parseImport(text: string): StateParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'The file does not contain a TakTic backup.' };
  }
  const wrapper = parsed as Record<string, unknown>;
  const payload = wrapper.state && typeof wrapper.state === 'object' ? wrapper.state : parsed;
  return normalizeState(payload);
}
