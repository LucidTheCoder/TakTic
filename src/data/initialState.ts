import type { TakTicState } from '../types';
import { emptyStreak } from '../services/gamification/streak';
import { defaultSettings } from '../services/gamification/xp';
import { generateObjectives } from '../services/gamification/objectives';
import { SCHEMA_VERSION } from '../services/storage/storage';
import { todayKey } from '../utils/date';
import { uid } from '../utils/id';

export function createInitialState(): TakTicState {
  const settings = defaultSettings();
  const now = new Date().toISOString();
  return {
    version: SCHEMA_VERSION,
    profile: {
      id: uid('user'),
      displayName: 'Student',
      level: 1,
      xp: 0,
      createdAt: now,
      preferences: {
        theme: 'light',
        accent: 'matcha',
        accentChanged: false,
        reducedMotion: false,
      },
    },
    settings,
    projects: [],
    tasks: [],
    focusSessions: [],
    achievements: [],
    xpTransactions: [],
    objectives: generateObjectives([], [], settings.xp.objective),
    objectivesDate: todayKey(),
    adaptations: [],
    streak: emptyStreak(),
    dailyPlans: [],
    activeSession: null,
    focusCycle: 0,
    pendingReviewSessionId: null,
    companionMessages: [],
    demoLoaded: false,
    lastSavedAt: now,
  };
}
