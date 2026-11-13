import type { ActivityDay, StreakData } from '../../types';
import { addDays, diffCalendarDays, todayKey } from '../../utils/date';

export function emptyStreak(): StreakData {
  return {
    currentStreak: 0,
    longestStreak: 0,
    totalActiveDays: 0,
    lastActiveDate: null,
    activityDates: [],
  };
}

function uniqueSortedDays(days: ActivityDay[]): ActivityDay[] {
  const map = new Map<string, ActivityDay>();
  for (const day of days) {
    const existing = map.get(day.date);
    if (existing) {
      existing.tasks += day.tasks;
      existing.focusMinutes += day.focusMinutes;
    } else {
      map.set(day.date, { ...day });
    }
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function computeLongestStreak(days: ActivityDay[]): number {
  const sorted = uniqueSortedDays(days);
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of sorted) {
    if (previous && diffCalendarDays(previous, day.date) === 1) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    previous = day.date;
  }
  return longest;
}

/**
 * A streak stays alive while the most recent activity is today or yesterday.
 * Counts consecutive active days ending at that most recent activity.
 */
export function computeCurrentStreak(days: ActivityDay[], today = todayKey()): number {
  if (days.length === 0) return 0;
  const sorted = uniqueSortedDays(days);
  const activeDates = new Set(sorted.map((day) => day.date));
  let cursor = activeDates.has(today) ? today : addDays(today, -1);
  if (!activeDates.has(cursor)) return 0;
  let count = 0;
  while (activeDates.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export function recordActivity(
  streak: StreakData,
  dateKey: string,
  delta: { tasks?: number; focusMinutes?: number },
): StreakData {
  const days = uniqueSortedDays(streak.activityDates);
  const existing = days.find((day) => day.date === dateKey);
  if (existing) {
    existing.tasks += delta.tasks ?? 0;
    existing.focusMinutes += delta.focusMinutes ?? 0;
  } else {
    days.push({
      date: dateKey,
      tasks: delta.tasks ?? 0,
      focusMinutes: Math.max(0, delta.focusMinutes ?? 0),
    });
    days.sort((a, b) => a.date.localeCompare(b.date));
  }
  const today = todayKey();
  const normalizedDays = uniqueSortedDays(days);
  return {
    activityDates: normalizedDays,
    totalActiveDays: normalizedDays.length,
    lastActiveDate: normalizedDays[normalizedDays.length - 1]?.date ?? null,
    longestStreak: Math.max(streak.longestStreak, computeLongestStreak(normalizedDays)),
    currentStreak: computeCurrentStreak(normalizedDays, today),
  };
}

export function rebuildStreak(state: {
  tasks: { completedAt: string | null; status: string; childTaskIds: string[]; id: string }[];
  focusSessions: { startTime: string; type: string; status: string; actualSeconds: number }[];
}): StreakData {
  const dayMap = new Map<string, ActivityDay>();
  const parentIds = new Set(
    state.tasks.map((task) => (task.childTaskIds.length > 0 ? task.id : null)).filter(Boolean),
  );
  for (const task of state.tasks) {
    if (task.status !== 'completed' || !task.completedAt) continue;
    if (parentIds.has(task.id)) continue;
    const key = task.completedAt.slice(0, 10);
    const day = dayMap.get(key) ?? { date: key, tasks: 0, focusMinutes: 0 };
    day.tasks += 1;
    dayMap.set(key, day);
  }
  for (const session of state.focusSessions) {
    if (session.type !== 'focus' || session.status !== 'completed') continue;
    const key = session.startTime.slice(0, 10);
    const day = dayMap.get(key) ?? { date: key, tasks: 0, focusMinutes: 0 };
    day.focusMinutes += Math.round(session.actualSeconds / 60);
    dayMap.set(key, day);
  }
  const days = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  return {
    activityDates: days,
    totalActiveDays: days.length,
    lastActiveDate: days[days.length - 1]?.date ?? null,
    longestStreak: computeLongestStreak(days),
    currentStreak: computeCurrentStreak(days),
  };
}

export function activityForDay(streak: StreakData, dateKey: string): ActivityDay | null {
  return streak.activityDates.find((day) => day.date === dateKey) ?? null;
}

export function streakIsAlive(streak: StreakData): boolean {
  const today = todayKey();
  return (
    streak.activityDates.some((day) => day.date === today) ||
    streak.activityDates.some((day) => day.date === addDays(today, -1))
  );
}
