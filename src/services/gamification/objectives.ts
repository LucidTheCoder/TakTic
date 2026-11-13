import type { DailyObjective, FocusSession, Project, Task } from '../../types';
import { toDateKey, todayKey } from '../../utils/date';
import { leafTasks, PRIORITY_ORDER } from '../../utils/tasks';

/** Pick the active project that deserves the day's third objective. */
export function priorityProject(projects: Project[], tasks: Task[]): Project | null {
  const active = projects.filter(
    (project) => project.status === 'active' && tasks.some((task) => task.projectId === project.id),
  );
  if (active.length === 0) return null;
  return [...active].sort((a, b) => {
    const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
    const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || aDeadline - bDeadline;
  })[0];
}

export function generateObjectives(
  projects: Project[],
  tasks: Task[],
  xpReward: number,
  date = todayKey(),
): DailyObjective[] {
  const project = priorityProject(projects, tasks);
  const objectives: DailyObjective[] = [
    {
      id: `${date}-tasks`,
      date,
      kind: 'tasks',
      description: 'Complete three tasks',
      target: 3,
      currentProgress: 0,
      completed: false,
      xpReward,
    },
    {
      id: `${date}-focus`,
      date,
      kind: 'focus',
      description: 'Finish two focus sessions',
      target: 2,
      currentProgress: 0,
      completed: false,
      xpReward,
    },
  ];
  if (project) {
    objectives.push({
      id: `${date}-project`,
      date,
      kind: 'project',
      description: `Make progress on ${project.title}`,
      target: 1,
      currentProgress: 0,
      completed: false,
      xpReward,
      projectId: project.id,
    });
  } else {
    objectives.push({
      id: `${date}-extra`,
      date,
      kind: 'tasks',
      description: 'Finish one more task',
      target: 1,
      currentProgress: 0,
      completed: false,
      xpReward,
    });
  }
  return objectives;
}

export function objectiveProgress(
  objective: DailyObjective,
  tasks: Task[],
  focusSessions: FocusSession[],
  date: string,
): number {
  if (objective.kind === 'tasks') {
    const completedToday = leafTasks(tasks).filter(
      (task) =>
        task.status === 'completed' && task.completedAt && toDateKey(task.completedAt) === date,
    ).length;
    return objective.id.endsWith('-extra')
      ? Math.min(completedToday, objective.target)
      : Math.min(completedToday, objective.target);
  }
  if (objective.kind === 'focus') {
    return focusSessions.filter(
      (session) =>
        session.type === 'focus' &&
        session.status === 'completed' &&
        toDateKey(session.startTime) === date,
    ).length;
  }
  if (objective.kind === 'project' && objective.projectId) {
    return leafTasks(tasks, objective.projectId).filter(
      (task) =>
        task.status === 'completed' && task.completedAt && toDateKey(task.completedAt) === date,
    ).length;
  }
  return 0;
}

export function refreshObjectives(
  objectives: DailyObjective[],
  tasks: Task[],
  focusSessions: FocusSession[],
  date: string,
): DailyObjective[] {
  return objectives.map((objective) => {
    const current = objectiveProgress(objective, tasks, focusSessions, date);
    return {
      ...objective,
      currentProgress: Math.min(current, objective.target),
      completed: objective.completed || current >= objective.target,
    };
  });
}
