import type { AppSettings, Difficulty, XpConfig } from '../../types';

export const DEFAULT_XP: XpConfig = {
  easy: 15,
  medium: 30,
  hard: 50,
  focus: 10,
  objective: 25,
  project: 100,
};

export const LEVEL_BASE = 120;
export const LEVEL_STEP = 45;

export function xpToNextLevel(level: number): number {
  return LEVEL_BASE + Math.max(0, level - 1) * LEVEL_STEP;
}

export interface LevelInfo {
  level: number;
  totalXp: number;
  intoLevel: number;
  forNext: number;
  percent: number;
  title: string;
}

const LEVEL_TITLES = [
  'Starting out',
  'Finding footing',
  'Steady steps',
  'Clear rhythm',
  'Deep work',
  'Quiet momentum',
  'Composed focus',
  'Long horizon',
  'Editorial mind',
];

export function levelInfo(totalXp: number): LevelInfo {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));
  while (remaining >= xpToNextLevel(level) && level < 99) {
    remaining -= xpToNextLevel(level);
    level += 1;
  }
  const forNext = xpToNextLevel(level);
  return {
    level,
    totalXp: Math.max(0, Math.floor(totalXp)),
    intoLevel: remaining,
    forNext,
    percent: Math.round((remaining / forNext) * 100),
    title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
  };
}

export function xpForDifficulty(difficulty: Difficulty, xp: XpConfig): number {
  return xp[difficulty];
}

export function defaultSettings(): AppSettings {
  return {
    focus: {
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      sessionsBeforeLongBreak: 4,
      autoStartBreaks: false,
      sound: true,
      ambient: 'silent',
      distractionFree: false,
    },
    ai: {
      apiKey: '',
      // OpenRouter's Free Models Router: selects an available zero-cost model per request.
      model: 'openrouter/free',
      companionStyle: 'concise',
    },
    notifications: {
      inApp: true,
      browser: false,
      deadlines: true,
      focus: true,
      achievements: true,
      objectives: true,
    },
    dashboard: {
      order: [
        'dailyProgress',
        'progression',
        'todayTasks',
        'objectives',
        'activeProjects',
        'deadlines',
        'focusStats',
        'recentAchievements',
        'companionNote',
      ],
      hidden: [],
    },
    shortcutsEnabled: true,
    xp: DEFAULT_XP,
    planner: {
      availableMinutes: 150,
      startHour: 9,
      focusMinutes: 25,
    },
  };
}
