export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'completed';
export type ProjectStatus = 'active' | 'completed' | 'archived';
export type SessionType = 'focus' | 'short' | 'long';
export type SessionStatus = 'completed' | 'abandoned';
export type AccentName = 'vermilion' | 'indigo' | 'matcha' | 'ochre';

export interface UserPreferences {
  theme: 'light' | 'dark';
  accent: AccentName;
  reducedMotion: boolean;
}

export interface UserProfile {
  id: string;
  displayName: string;
  /** A single glyph or an empty string for initials. */
  avatar?: string;
  level: number;
  xp: number;
  createdAt: string;
  preferences: UserPreferences;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  deadline: string | null;
  priority: Priority;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  isDemo?: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  title: string;
  description: string;
  estimatedMinutes: number;
  actualMinutes: number;
  difficulty: Difficulty;
  priority: Priority;
  xpReward: number;
  status: TaskStatus;
  deadline: string | null;
  deadlineHasTime: boolean;
  scheduledDate: string | null;
  dependencies: string[];
  blockedReason: string | null;
  childTaskIds: string[];
  createdAt: string;
  completedAt: string | null;
  order: number;
  lastAdaptedAt?: string | null;
  isDemo?: boolean;
}

export interface FocusSession {
  id: string;
  taskId: string | null;
  type: SessionType;
  plannedSeconds: number;
  actualSeconds: number;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  xpAwarded: boolean;
  notes?: string;
  isDemo?: boolean;
}

export interface AchievementUnlock {
  id: string;
  unlockedAt: string;
  isDemo?: boolean;
}

export interface XpTransaction {
  id: string;
  source: string;
  amount: number;
  timestamp: string;
  label?: string;
  isDemo?: boolean;
}

export type ObjectiveKind = 'tasks' | 'focus' | 'project';

export interface DailyObjective {
  id: string;
  date: string;
  kind: ObjectiveKind;
  description: string;
  target: number;
  currentProgress: number;
  completed: boolean;
  xpReward: number;
  projectId?: string;
}

export type FeedbackType =
  | 'understand'
  | 'start'
  | 'too_big'
  | 'concentration'
  | 'time'
  | 'resources'
  | 'other';

export interface AdaptationRecord {
  id: string;
  taskId: string;
  feedbackType: FeedbackType;
  userExplanation: string;
  generatedTasks: string[];
  reasoning: string;
  createdAt: string;
  isDemo?: boolean;
}

export interface ActivityDay {
  date: string;
  tasks: number;
  focusMinutes: number;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  lastActiveDate: string | null;
  activityDates: ActivityDay[];
}

export interface ActiveSession {
  id: string;
  type: SessionType;
  taskId: string | null;
  plannedSeconds: number;
  startedAt: number;
  endsAt: number;
  remainingMs: number | null;
  status: 'running' | 'paused';
  focusCycleBefore: number;
}

export interface PlanBlock {
  id: string;
  kind: 'focus' | 'break' | 'longBreak';
  start: string;
  end: string;
  taskId: string | null;
  label: string;
  minutes: number;
}

export interface DailyPlan {
  id: string;
  date: string;
  startTime: string;
  availableMinutes: number;
  blocks: PlanBlock[];
  summary: string;
  source: 'ai' | 'rule-based';
  createdAt: string;
}

export interface CompanionSuggestion {
  label: string;
  taskId?: string;
}

export interface CompanionMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  suggestions?: CompanionSuggestion[];
  isError?: boolean;
  isDemo?: boolean;
}

export interface XpConfig {
  easy: number;
  medium: number;
  hard: number;
  focus: number;
  objective: number;
  project: number;
}

export type DashboardWidgetId =
  | 'dailyProgress'
  | 'progression'
  | 'todayTasks'
  | 'activeProjects'
  | 'objectives'
  | 'deadlines'
  | 'focusStats'
  | 'recentAchievements'
  | 'companionNote';

export interface FocusSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
  autoStartBreaks: boolean;
  sound: boolean;
  ambient: 'silent' | 'brown' | 'rain';
  distractionFree: boolean;
}

export interface AiSettings {
  apiKey: string;
  model: string;
  companionStyle: 'concise' | 'warm' | 'direct';
}

export interface NotificationSettings {
  inApp: boolean;
  browser: boolean;
  deadlines: boolean;
  focus: boolean;
  achievements: boolean;
  objectives: boolean;
}

export interface DashboardSettings {
  order: DashboardWidgetId[];
  hidden: DashboardWidgetId[];
}

export interface AppSettings {
  focus: FocusSettings;
  ai: AiSettings;
  notifications: NotificationSettings;
  dashboard: DashboardSettings;
  shortcutsEnabled: boolean;
  xp: XpConfig;
  planner: {
    availableMinutes: number;
    startHour: number;
    focusMinutes: number;
  };
}

export interface TakTicState {
  version: number;
  profile: UserProfile;
  settings: AppSettings;
  projects: Project[];
  tasks: Task[];
  focusSessions: FocusSession[];
  achievements: AchievementUnlock[];
  xpTransactions: XpTransaction[];
  objectives: DailyObjective[];
  objectivesDate: string;
  adaptations: AdaptationRecord[];
  streak: StreakData;
  dailyPlans: DailyPlan[];
  activeSession: ActiveSession | null;
  focusCycle: number;
  pendingReviewSessionId: string | null;
  companionMessages: CompanionMessage[];
  demoLoaded: boolean;
  lastSavedAt: string | null;
}

export interface TaskDraft {
  title: string;
  description?: string;
  estimatedMinutes: number;
  difficulty: Difficulty;
  priority?: Priority;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
  /** Current progress toward the unlock condition. */
  progress: (state: TakTicState) => { current: number; target: number };
  /** Whether the unlock condition is satisfied. */
  isMet: (state: TakTicState) => boolean;
}
