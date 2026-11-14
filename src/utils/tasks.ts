import type { Difficulty, Priority, Project, TakTicState, Task } from '../types';
import { toDateKey, todayKey } from './date';

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const PRIORITY_ORDER: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

export const PRIORITY_DOT: Record<Priority, string> = {
  urgent: 'bg-accent',
  high: 'bg-accent/60',
  medium: 'bg-muted',
  low: 'bg-transparent border border-muted/60',
};

export const PROJECT_DEADLINE_TONE: Record<Priority, string> = {
  urgent: 'text-accent',
  high: 'text-ink',
  medium: 'text-muted',
  low: 'text-muted',
};

function taskRank(a: Task, b: Task): number {
  if (a.status === 'completed' && b.status !== 'completed') return 1;
  if (b.status === 'completed' && a.status !== 'completed') return -1;
  return (
    PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
    (a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER) -
      (b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER) ||
    a.order - b.order ||
    a.createdAt.localeCompare(b.createdAt)
  );
}

/**
 * Places prerequisites before the tasks that depend on them. Priority only
 * decides between tasks that are ready at the same time. A cycle, or a blocker
 * outside the visible list, pushes the remainder to the end instead of looping.
 */
export function orderTasksByDependencies(
  tasks: Task[],
  allTasks: Task[] = tasks,
  rank: (a: Task, b: Task) => number = taskRank,
): Task[] {
  const ids = new Set(tasks.map((task) => task.id));
  const byId = new Map(allTasks.map((task) => [task.id, task]));
  const remaining = new Map(tasks.map((task) => [task.id, task]));
  const placed = new Set<string>();
  const ordered: Task[] = [];

  const satisfied = (dependencyId: string): boolean => {
    const dependency = byId.get(dependencyId);
    if (!dependency) return true;
    if (dependency.status === 'completed') return true;
    if (!ids.has(dependencyId)) return false;
    return placed.has(dependencyId);
  };

  while (remaining.size > 0) {
    const ready = [...remaining.values()]
      .filter((task) => task.dependencies.every((dependencyId) => dependencyId !== task.id && satisfied(dependencyId)))
      .sort(rank);
    if (ready.length === 0) {
      ordered.push(...[...remaining.values()].sort(rank));
      break;
    }
    const next = ready[0];
    ordered.push(next);
    placed.add(next.id);
    remaining.delete(next.id);
  }

  return ordered;
}

export function childrenOf(tasks: Task[], taskId: string): Task[] {
  return orderTasksByDependencies(
    tasks.filter((task) => task.parentTaskId === taskId),
    tasks,
  );
}

/** True when adding these prerequisite edges would form a loop. */
export function wouldCreateDependencyCycle(
  taskId: string,
  dependencyIds: string[],
  tasks: Task[],
): boolean {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const reachesTask = (fromId: string, seen: Set<string>): boolean => {
    if (fromId === taskId) return true;
    if (seen.has(fromId)) return false;
    seen.add(fromId);
    const from = byId.get(fromId);
    if (!from) return false;
    return from.dependencies.some((nextId) => reachesTask(nextId, seen));
  };
  return dependencyIds.some(
    (dependencyId) => dependencyId === taskId || reachesTask(dependencyId, new Set()),
  );
}

/** Drops self-references and edges that would create a cycle. */
export function sanitizeDependencies(tasks: Task[]): Task[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const accepted = new Map<string, string[]>();
  const reaches = (fromId: string, targetId: string, seen: Set<string>): boolean => {
    if (fromId === targetId) return true;
    if (seen.has(fromId)) return false;
    seen.add(fromId);
    return (accepted.get(fromId) ?? []).some((nextId) => reaches(nextId, targetId, seen));
  };

  for (const task of tasks) {
    const valid = task.dependencies.filter((dependencyId) => {
      if (dependencyId === task.id || !byId.has(dependencyId)) return false;
      return !reaches(dependencyId, task.id, new Set());
    });
    accepted.set(task.id, valid);
  }

  return tasks.map((task) => ({
    ...task,
    dependencies: accepted.get(task.id) ?? [],
  }));
}

export function hasChildren(tasks: Task[], taskId: string): boolean {
  return tasks.some((task) => task.parentTaskId === taskId);
}

export function descendantsOf(tasks: Task[], taskId: string): Task[] {
  const result: Task[] = [];
  const queue = [taskId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const child of tasks.filter((task) => task.parentTaskId === current)) {
      result.push(child);
      queue.push(child.id);
    }
  }
  return result;
}

export function ancestorsOf(tasks: Task[], taskId: string): Task[] {
  const result: Task[] = [];
  let current = tasks.find((task) => task.id === taskId);
  while (current?.parentTaskId) {
    const parent = tasks.find((task) => task.id === current?.parentTaskId);
    if (!parent) break;
    result.push(parent);
    current = parent;
  }
  return result;
}

/** Actionable tasks are leaves — parents are containers and never double-counted. */
export function leafTasks(tasks: Task[], projectId?: string): Task[] {
  const parents = new Set(tasks.map((task) => task.parentTaskId).filter(Boolean));
  return tasks.filter((task) => !parents.has(task.id) && (!projectId || task.projectId === projectId));
}

export function projectTasks(tasks: Task[], projectId: string): Task[] {
  return tasks.filter((task) => task.projectId === projectId);
}

export interface ProgressSummary {
  total: number;
  completed: number;
  remaining: number;
  percent: number;
  hasTasks: boolean;
}

export function calculateProgress(tasks: Task[], projectId?: string): ProgressSummary {
  const leaves = leafTasks(tasks, projectId);
  const total = leaves.length;
  const completed = leaves.filter((task) => task.status === 'completed').length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, remaining: total - completed, percent, hasTasks: total > 0 };
}

export function projectProgress(project: Project, tasks: Task[]): ProgressSummary {
  return calculateProgress(tasks, project.id);
}

export function tasksForDate(tasks: Task[], dateKey: string): Task[] {
  return tasks.filter((task) => {
    if (task.scheduledDate === dateKey) return true;
    if (task.deadline && toDateKey(task.deadline) === dateKey) return true;
    return false;
  });
}

export function todayTasks(tasks: Task[]): Task[] {
  return tasksForDate(tasks, todayKey());
}

export function dailyProgress(tasks: Task[]): ProgressSummary {
  const todays = todayTasks(tasks);
  const actionable = todays.filter((task) => !hasChildren(tasks, task.id));
  const total = actionable.length;
  const completed = actionable.filter((task) => task.status === 'completed').length;
  return {
    total,
    completed,
    remaining: total - completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    hasTasks: total > 0,
  };
}

export function openLeaves(tasks: Task[]): Task[] {
  return leafTasks(tasks).filter((task) => task.status !== 'completed');
}

export function nextTaskCandidate(tasks: Task[], projects: Project[]): Task | null {
  const candidates = openLeaves(tasks).filter(
    (task) => task.status !== 'blocked' && incompleteDependencies(task, tasks).length === 0,
  );
  if (candidates.length === 0) return null;
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  return orderTasksByDependencies(candidates, tasks, (a, b) => {
    const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
    const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
    if (a.scheduledDate === todayKey() && b.scheduledDate !== todayKey()) return -1;
    if (b.scheduledDate === todayKey() && a.scheduledDate !== todayKey()) return 1;
    if (aDeadline !== bDeadline) return aDeadline - bDeadline;
    const priority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priority !== 0) return priority;
    const aProject = projectMap.get(a.projectId);
    const bProject = projectMap.get(b.projectId);
    const pA = aProject ? PRIORITY_ORDER[aProject.priority] : 4;
    const pB = bProject ? PRIORITY_ORDER[bProject.priority] : 4;
    return pA - pB || a.order - b.order;
  })[0];
}

export function tasksCompletedOn(tasks: Task[], dateKey: string): Task[] {
  return tasks.filter((task) => task.completedAt && toDateKey(task.completedAt) === dateKey);
}

export function focusMinutesOn(state: TakTicState, dateKey: string): number {
  return Math.round(
    state.focusSessions
      .filter((session) => session.type === 'focus' && session.status === 'completed')
      .filter((session) => toDateKey(session.startTime) === dateKey)
      .reduce((sum, session) => sum + session.actualSeconds / 60, 0),
  );
}

export function focusSessionsOn(state: TakTicState, dateKey: string): number {
  return state.focusSessions.filter(
    (session) =>
      session.type === 'focus' &&
      session.status === 'completed' &&
      toDateKey(session.startTime) === dateKey,
  ).length;
}

export function activeProjects(projects: Project[]): Project[] {
  return projects.filter((project) => project.status === 'active');
}

export function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
    const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
    return aDeadline - bDeadline || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  });
}

export function incompleteDependencies(task: Task, tasks: Task[]): Task[] {
  return (task.dependencies ?? [])
    .map((id) => tasks.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is Task => Boolean(candidate) && candidate?.status !== 'completed');
}

export function displayDate(iso: string | null): string {
  if (!iso) return '';
  return toDateKey(iso);
}
