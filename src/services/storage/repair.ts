import type { Task, TakTicState } from '../../types';
import { todayKey } from '../../utils/date';
import { generateObjectives, refreshObjectives } from '../gamification/objectives';
import { levelInfo, summarizeXp } from '../gamification/xp';
import { computeCurrentStreak, computeLongestStreak } from '../gamification/streak';
import { SCHEMA_VERSION } from './storage';

/** Rebuild childTaskIds from parentTaskId so hierarchy links can never drift. */
export function syncChildLinks(tasks: Task[]): Task[] {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.parentTaskId) continue;
    const list = groups.get(task.parentTaskId) ?? [];
    list.push(task);
    groups.set(task.parentTaskId, list);
  }
  return tasks.map((task) => ({
    ...task,
    childTaskIds: (groups.get(task.id) ?? [])
      .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))
      .map((child) => child.id),
  }));
}

export function xpFromLedger(state: TakTicState): number {
  return summarizeXp(state.xpTransactions).total;
}

/**
 * Bring a persisted or imported state back to a coherent shape without
 * awarding or removing earned XP. Safe to run on every load.
 */
export function prepareState(state: TakTicState): TakTicState {
  const tasks = syncChildLinks(state.tasks);
  const xp = xpFromLedger(state);
  const level = levelInfo(xp).level;
  const today = todayKey();

  let objectives = state.objectives;
  if (state.objectivesDate !== today || objectives.length === 0) {
    objectives = generateObjectives(
      state.projects,
      tasks,
      state.settings.xp.objective,
      today,
    );
  }
  objectives = refreshObjectives(objectives, tasks, state.focusSessions, today);

  const activityDates = [...state.streak.activityDates].sort((a, b) => a.date.localeCompare(b.date));
  const streak = {
    ...state.streak,
    activityDates,
    totalActiveDays: activityDates.length,
    longestStreak: Math.max(state.streak.longestStreak, computeLongestStreak(activityDates)),
    currentStreak: computeCurrentStreak(activityDates, today),
    lastActiveDate: activityDates[activityDates.length - 1]?.date ?? null,
  };

  return {
    ...state,
    version: SCHEMA_VERSION,
    tasks,
    profile: { ...state.profile, xp, level },
    objectives,
    objectivesDate: today,
    streak,
    pendingReviewSessionId:
      state.pendingReviewSessionId &&
      state.focusSessions.some((session) => session.id === state.pendingReviewSessionId)
        ? state.pendingReviewSessionId
        : null,
    lastSavedAt: state.lastSavedAt,
  };
}
