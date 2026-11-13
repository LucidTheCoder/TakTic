import type { AchievementDefinition, FocusSession, TakTicState, Task } from '../../types';
import { leafTasks } from '../../utils/tasks';

function completedLeafTasks(state: TakTicState): Task[] {
  return leafTasks(state.tasks).filter((task) => task.status === 'completed');
}

function qualifyingFocusSessions(state: TakTicState): FocusSession[] {
  return state.focusSessions.filter(
    (session) => session.type === 'focus' && session.status === 'completed',
  );
}

function adaptedTaskCounts(state: TakTicState): Map<string, number> {
  const map = new Map<string, number>();
  for (const record of state.adaptations) {
    map.set(record.taskId, (map.get(record.taskId) ?? 0) + 1);
  }
  return map;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first-step',
    name: 'First Step',
    description: 'Complete your first task.',
    icon: 'footprints',
    xpReward: 20,
    progress: (state) => ({ current: Math.min(completedLeafTasks(state).length, 1), target: 1 }),
    isMet: (state) => completedLeafTasks(state).length >= 1,
  },
  {
    id: 'getting-started',
    name: 'Getting Started',
    description: 'Complete your first focus session.',
    icon: 'timer',
    xpReward: 20,
    progress: (state) => ({ current: Math.min(qualifyingFocusSessions(state).length, 1), target: 1 }),
    isMet: (state) => qualifyingFocusSessions(state).length >= 1,
  },
  {
    id: 'project-pioneer',
    name: 'Project Pioneer',
    description: 'Complete your first project.',
    icon: 'folder-check',
    xpReward: 40,
    progress: (state) => ({
      current: Math.min(
        state.projects.filter((project) => project.status === 'completed').length,
        1,
      ),
      target: 1,
    }),
    isMet: (state) => state.projects.some((project) => project.status === 'completed'),
  },
  {
    id: 'consistency',
    name: 'Consistency',
    description: 'Complete ten tasks.',
    icon: 'list-checks',
    xpReward: 50,
    progress: (state) => ({ current: Math.min(completedLeafTasks(state).length, 10), target: 10 }),
    isMet: (state) => completedLeafTasks(state).length >= 10,
  },
  {
    id: 'momentum',
    name: 'Momentum',
    description: 'Complete fifty tasks.',
    icon: 'flame',
    xpReward: 120,
    progress: (state) => ({ current: Math.min(completedLeafTasks(state).length, 50), target: 50 }),
    isMet: (state) => completedLeafTasks(state).length >= 50,
  },
  {
    id: 'adaptive-mindset',
    name: 'Adaptive Mindset',
    description: 'Use adaptive decomposition on a task.',
    icon: 'puzzle',
    xpReward: 25,
    progress: (state) => ({
      current: Math.min(new Set(state.adaptations.map((record) => record.taskId)).size, 1),
      target: 1,
    }),
    isMet: (state) => state.adaptations.length >= 1,
  },
  {
    id: 'persistence',
    name: 'Persistence',
    description: 'Break the same task down more than once, and keep going.',
    icon: 'repeat',
    xpReward: 40,
    progress: (state) => {
      const counts = adaptedTaskCounts(state);
      const best = Math.max(0, ...counts.values());
      return { current: Math.min(best, 2), target: 2 };
    },
    isMet: (state) => Math.max(0, ...adaptedTaskCounts(state).values()) >= 2,
  },
  {
    id: 'seven-days',
    name: 'Seven Days',
    description: 'Hold a seven-day activity streak.',
    icon: 'calendar-check',
    xpReward: 60,
    progress: (state) => ({
      current: Math.min(Math.max(state.streak.currentStreak, state.streak.longestStreak), 7),
      target: 7,
    }),
    isMet: (state) => Math.max(state.streak.currentStreak, state.streak.longestStreak) >= 7,
  },
  {
    id: 'deep-focus',
    name: 'Deep Focus',
    description: 'Finish ten focus sessions.',
    icon: 'target',
    xpReward: 60,
    progress: (state) => ({
      current: Math.min(qualifyingFocusSessions(state).length, 10),
      target: 10,
    }),
    isMet: (state) => qualifyingFocusSessions(state).length >= 10,
  },
  {
    id: 'cartographer',
    name: 'Cartographer',
    description: 'Generate a daily plan.',
    icon: 'compass',
    xpReward: 30,
    progress: (state) => ({ current: Math.min(state.dailyPlans.length, 1), target: 1 }),
    isMet: (state) => state.dailyPlans.length >= 1,
  },
  {
    id: 'three-projects',
    name: 'Body of Work',
    description: 'Complete three projects.',
    icon: 'library-big',
    xpReward: 80,
    progress: (state) => ({
      current: Math.min(
        state.projects.filter((project) => project.status === 'completed').length,
        3,
      ),
      target: 3,
    }),
    isMet: (state) => state.projects.filter((project) => project.status === 'completed').length >= 3,
  },
];

export function achievementById(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((achievement) => achievement.id === id);
}

export function newlyUnlockedAchievements(
  state: TakTicState,
  currentlyUnlocked: Set<string>,
): AchievementDefinition[] {
  return ACHIEVEMENTS.filter(
    (achievement) => !currentlyUnlocked.has(achievement.id) && achievement.isMet(state),
  );
}
