import type { AchievementUnlock, Project, SessionType, TakTicState, Task } from '../types';
import {
  activeProjects,
  calculateProgress,
  dailyProgress,
  focusMinutesOn,
  focusSessionsOn,
  leafTasks,
  nextTaskCandidate,
  openLeaves,
  projectProgress,
  sortProjects,
  tasksCompletedOn,
  tasksForDate,
  todayTasks,
  PRIORITY_ORDER,
} from '../utils/tasks';
import { levelInfo, type LevelInfo } from '../services/gamification/xp';
import { todayKey, weekKeys } from '../utils/date';
import { computeCurrentStreak } from '../services/gamification/streak';
import { ACHIEVEMENTS } from '../services/gamification/achievements';

export interface ProjectSummary {
  project: Project;
  progress: ReturnType<typeof calculateProgress>;
}

export interface DaySummary {
  date: string;
  completed: number;
  focusMinutes: number;
  scheduled: number;
}

export interface DerivedStats {
  level: LevelInfo;
  today: string;
  todaysTasks: Task[];
  todayProgress: ReturnType<typeof dailyProgress>;
  activeProjects: Project[];
  projectSummaries: ProjectSummary[];
  currentStreak: number;
  streakAlive: boolean;
  todayFocusMinutes: number;
  todayFocusSessions: number;
  weekFocusMinutes: number;
  completedTasksCount: number;
  completedProjectsCount: number;
  openTasks: Task[];
  overdueTasks: Task[];
  nextTask: Task | null;
  upcomingDeadlines: Task[];
  weekDays: DaySummary[];
  totalFocusMinutes: number;
  recentSessions: TakTicState['focusSessions'];
  estimateAccuracy: {
    samples: number;
    averageDeviation: number;
    direction: 'over' | 'under' | 'balanced' | 'none';
  };
  activityDates: TakTicState['streak']['activityDates'];
  unlockedAchievements: AchievementUnlock[];
  sessionCountByType: Record<SessionType, number>;
}

function sortTodayTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (b.status === 'completed' && a.status !== 'completed') return -1;
    return (
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      a.order - b.order ||
      a.createdAt.localeCompare(b.createdAt)
    );
  });
}

function computeEstimateAccuracy(state: TakTicState): DerivedStats['estimateAccuracy'] {
  const samples = leafTasks(state.tasks).filter(
    (task) => task.status === 'completed' && task.actualMinutes > 0 && task.estimatedMinutes > 0,
  );
  if (samples.length === 0) {
    return { samples: 0, averageDeviation: 0, direction: 'none' };
  }
  const deviations = samples.map(
    (task) => (task.actualMinutes - task.estimatedMinutes) / task.estimatedMinutes,
  );
  const average = deviations.reduce((sum, value) => sum + value, 0) / deviations.length;
  const averageDeviation = Math.round(Math.abs(average) * 100);
  return {
    samples: samples.length,
    averageDeviation,
    direction:
      averageDeviation <= 10 ? 'balanced' : average > 0 ? 'under' : 'over',
  };
}

export function derive(state: TakTicState): DerivedStats {
  const today = todayKey();
  const level = levelInfo(state.profile.xp);
  const todayScheduled = tasksForDate(state.tasks, today);
  const projectSummaries = sortProjects(state.projects).map((project) => ({
    project,
    progress: projectProgress(project, state.tasks),
  }));
  const week = weekKeys(today);
  const open = openLeaves(state.tasks);
  const overdue = open.filter((task) => task.deadline && new Date(task.deadline).getTime() < Date.now());
  const upcoming = [...open]
    .filter((task) => task.deadline)
    .sort((a, b) => new Date(a.deadline as string).getTime() - new Date(b.deadline as string).getTime())
    .slice(0, 5);

  const weekDays: DaySummary[] = week.map((date) => {
    const scheduled = tasksForDate(state.tasks, date).filter(
      (task) => !state.tasks.some((candidate) => candidate.parentTaskId === task.id),
    );
    return {
      date,
      completed: tasksCompletedOn(state.tasks, date).filter(
        (task) => !state.tasks.some((candidate) => candidate.parentTaskId === task.id),
      ).length,
      focusMinutes: focusMinutesOn(state, date),
      scheduled: scheduled.length,
    };
  });

  const sessionCountByType = {
    focus: state.focusSessions.filter((session) => session.type === 'focus').length,
    short: state.focusSessions.filter((session) => session.type === 'short').length,
    long: state.focusSessions.filter((session) => session.type === 'long').length,
  };

  return {
    level,
    today,
    todaysTasks: sortTodayTasks(todayScheduled),
    todayProgress: dailyProgress(state.tasks),
    activeProjects: activeProjects(state.projects),
    projectSummaries,
    currentStreak: computeCurrentStreak(state.streak.activityDates, today),
    streakAlive:
      state.streak.activityDates.some((day) => day.date === today) ||
      state.streak.activityDates.some((day) => day.date === week[week.length - 1]),
    todayFocusMinutes: focusMinutesOn(state, today),
    todayFocusSessions: focusSessionsOn(state, today),
    weekFocusMinutes: week.reduce((sum, day) => sum + focusMinutesOn(state, day), 0),
    completedTasksCount: leafTasks(state.tasks).filter((task) => task.status === 'completed').length,
    completedProjectsCount: state.projects.filter((project) => project.status === 'completed').length,
    openTasks: open,
    overdueTasks: overdue,
    nextTask: nextTaskCandidate(state.tasks, state.projects),
    upcomingDeadlines: upcoming,
    weekDays,
    totalFocusMinutes: Math.round(
      state.focusSessions
        .filter((session) => session.type === 'focus' && session.status === 'completed')
        .reduce((sum, session) => sum + session.actualSeconds / 60, 0),
    ),
    recentSessions: [...state.focusSessions]
      .sort((a, b) => b.startTime.localeCompare(a.startTime))
      .slice(0, 6),
    estimateAccuracy: computeEstimateAccuracy(state),
    activityDates: state.streak.activityDates,
    unlockedAchievements: [...state.achievements].sort((a, b) =>
      b.unlockedAt.localeCompare(a.unlockedAt),
    ),
    sessionCountByType,
  };
}

export function achievementProgressText(
  state: TakTicState,
  achievementId: string,
): { current: number; target: number } {
  const definition = ACHIEVEMENTS.find((item) => item.id === achievementId);
  if (!definition) return { current: 0, target: 1 };
  return definition.progress(state);
}

export function todaysCompletedCount(tasks: Task[]): number {
  return todayTasks(tasks).filter(
    (task) => task.status === 'completed' && !tasks.some((candidate) => candidate.parentTaskId === task.id),
  ).length;
}
