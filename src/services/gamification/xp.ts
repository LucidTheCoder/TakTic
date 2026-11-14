import type { AppSettings, Difficulty, XpConfig, XpTransaction } from '../../types';
import { DEFAULT_AI_MODEL } from '../ai/models';

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

export interface XpBreakdown {
  task: number;
  focus: number;
  project: number;
  achievement: number;
  objective: number;
  other: number;
  total: number;
}

/**
 * The ledger is the only XP source of truth. Count each transaction id and
 * source once so an imported or historically duplicated event cannot inflate
 * the lifetime total.
 */
export function summarizeXp(transactions: XpTransaction[]): XpBreakdown {
  const seenIds = new Set<string>();
  const seenSources = new Set<string>();
  const breakdown: XpBreakdown = {
    task: 0,
    focus: 0,
    project: 0,
    achievement: 0,
    objective: 0,
    other: 0,
    total: 0,
  };

  for (const transaction of transactions) {
    if (!transaction.id || seenIds.has(transaction.id)) continue;
    if (!transaction.source || seenSources.has(transaction.source)) continue;
    seenIds.add(transaction.id);
    seenSources.add(transaction.source);
    const amount = Math.max(0, Math.floor(transaction.amount));
    if (transaction.source.startsWith('task:')) breakdown.task += amount;
    else if (transaction.source.startsWith('focus:')) breakdown.focus += amount;
    else if (transaction.source.startsWith('project:')) breakdown.project += amount;
    else if (transaction.source.startsWith('achievement:')) breakdown.achievement += amount;
    else if (transaction.source.startsWith('objective:')) breakdown.objective += amount;
    else breakdown.other += amount;
    breakdown.total += amount;
  }

  return breakdown;
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
      soundVolume: 0.75,
      ambient: 'silent',
      distractionFree: false,
    },
    ai: {
      apiKey: '',
      // A fast zero-cost model with free fallbacks when a provider is unavailable.
      model: DEFAULT_AI_MODEL,
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
        'todayTasks',
        'dailyProgress',
        'activeProjects',
        'focusStats',
        'objectives',
        'deadlines',
        'progression',
        'recentAchievements',
        'companionNote',
      ],
      hidden: [
        'objectives',
        'deadlines',
        'progression',
        'recentAchievements',
        'companionNote',
      ],
      customized: false,
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
