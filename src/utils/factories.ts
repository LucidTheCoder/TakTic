import type { Difficulty, Priority, Project, Task, XpConfig } from '../types';
import { uid } from './id';
import { xpForDifficulty } from '../services/gamification/xp';

interface TaskInput {
  projectId: string;
  title: string;
  description?: string;
  parentTaskId?: string | null;
  estimatedMinutes?: number;
  actualMinutes?: number;
  difficulty?: Difficulty;
  priority?: Priority;
  status?: Task['status'];
  deadline?: string | null;
  deadlineHasTime?: boolean;
  scheduledDate?: string | null;
  dependencies?: string[];
  blockedReason?: string | null;
  xp?: XpConfig;
  order?: number;
  id?: string;
  createdAt?: string;
  completedAt?: string | null;
}

export function buildTask(input: TaskInput): Task {
  const difficulty = input.difficulty ?? 'medium';
  return {
    id: input.id ?? uid('task'),
    projectId: input.projectId,
    parentTaskId: input.parentTaskId ?? null,
    title: input.title.trim(),
    description: input.description?.trim() ?? '',
    estimatedMinutes: Math.max(5, Math.round(input.estimatedMinutes ?? 25)),
    actualMinutes: Math.max(0, Math.round(input.actualMinutes ?? 0)),
    difficulty,
    priority: input.priority ?? 'medium',
    xpReward: xpForDifficulty(difficulty, input.xp ?? { easy: 15, medium: 30, hard: 50, focus: 10, objective: 25, project: 100 }),
    status: input.status ?? 'todo',
    deadline: input.deadline ?? null,
    deadlineHasTime: input.deadlineHasTime ?? false,
    scheduledDate: input.scheduledDate ?? null,
    dependencies: input.dependencies ?? [],
    blockedReason: input.blockedReason ?? null,
    childTaskIds: [],
    createdAt: input.createdAt ?? new Date().toISOString(),
    completedAt: input.completedAt ?? null,
    order: input.order ?? Date.now(),
  };
}

interface ProjectInput {
  title: string;
  description?: string;
  deadline?: string | null;
  priority?: Priority;
  status?: Project['status'];
  id?: string;
  createdAt?: string;
  completedAt?: string | null;
}

export function buildProject(input: ProjectInput): Project {
  const now = new Date().toISOString();
  return {
    id: input.id ?? uid('project'),
    title: input.title.trim(),
    description: input.description?.trim() ?? '',
    deadline: input.deadline ?? null,
    priority: input.priority ?? 'medium',
    status: input.status ?? 'active',
    createdAt: input.createdAt ?? now,
    updatedAt: now,
    completedAt: input.completedAt ?? null,
  };
}
