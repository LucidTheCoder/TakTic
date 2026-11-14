import type {
  ActiveSession,
  AdaptationRecord,
  AppSettings,
  CompanionMessage,
  DailyPlan,
  FeedbackType,
  FocusSession,
  PlanBlock,
  Project,
  SessionType,
  TakTicState,
  Task,
  TaskDraft,
  UserPreferences,
  UserProfile,
} from '../types';
import { descendantsOf, leafTasks } from '../utils/tasks';
import { addDays, todayKey } from '../utils/date';
import { uid } from '../utils/id';
import { createInitialState } from '../data/initialState';
import { createDemoState } from '../data/demo';
import { prepareState, syncChildLinks, xpFromLedger } from '../services/storage/repair';
import { levelInfo, summarizeXp } from '../services/gamification/xp';
import {
  generateObjectives,
  refreshObjectives,
} from '../services/gamification/objectives';
import { newlyUnlockedAchievements } from '../services/gamification/achievements';
import { recordActivity, rebuildStreak } from '../services/gamification/streak';
import { buildTask } from '../utils/factories';

export type Action =
  | { type: 'ADD_PROJECT'; project: Project }
  | { type: 'UPDATE_PROJECT'; id: string; patch: Partial<Project> }
  | { type: 'DELETE_PROJECT'; id: string }
  | { type: 'ADD_TASK'; task: Task }
  | { type: 'ADD_TASKS'; tasks: Task[]; projectId: string }
  | { type: 'UPDATE_TASK'; id: string; patch: Partial<Task> }
  | { type: 'DELETE_TASK'; id: string }
  | { type: 'TOGGLE_TASK'; id: string; cascade?: boolean }
  | { type: 'SET_BLOCKED'; id: string; blocked: boolean; reason?: string }
  | { type: 'MOVE_TASK'; id: string; projectId: string; parentTaskId: string | null }
  | { type: 'DUPLICATE_TASK'; id: string }
  | { type: 'REORDER_TASK'; id: string; direction: 'up' | 'down' }
  | {
      type: 'APPLY_ADAPTATION';
      taskId: string;
      record: AdaptationRecord;
      subtasks: TaskDraft[];
      revisedEstimateMinutes?: number;
      reframedTask?: { title: string; description: string };
    }
  | { type: 'START_SESSION'; sessionType: SessionType; taskId: string | null; plannedSeconds: number }
  | { type: 'PAUSE_SESSION' }
  | { type: 'RESUME_SESSION' }
  | { type: 'RESET_SESSION' }
  | { type: 'SET_SESSION_TASK'; taskId: string | null }
  | { type: 'COMPLETE_SESSION' }
  | { type: 'END_SESSION' }
  | { type: 'DISMISS_REVIEW' }
  | { type: 'UPDATE_SESSION_NOTES'; sessionId: string; notes: string }
  | { type: 'UPDATE_PROFILE'; patch: Partial<Pick<UserProfile, 'displayName' | 'avatar'>> }
  | { type: 'UPDATE_PREFERENCES'; patch: Partial<UserPreferences> }
  | { type: 'UPDATE_SETTINGS'; patch: Partial<AppSettings> }
  | { type: 'REFRESH_DAY' }
  | { type: 'LOAD_DEMO' }
  | { type: 'REMOVE_DEMO' }
  | { type: 'RESET' }
  | { type: 'IMPORT_STATE'; state: TakTicState }
  | { type: 'RESTORE_STATE'; state: TakTicState }
  | { type: 'ADD_COMPANION_MESSAGE'; message: CompanionMessage }
  | { type: 'CLEAR_COMPANION' }
  | { type: 'SAVE_PLAN'; plan: DailyPlan }
  | { type: 'DELETE_PLAN'; id: string };

interface SettleEvents {
  completedTaskIds?: string[];
  completedProjectIds?: string[];
  completedSessionId?: string;
  activity?: { date: string; tasks?: number; focusMinutes?: number };
}

const nowIso = () => new Date().toISOString();

function syncAndReconcileTasks(tasks: Task[]): Task[] {
  const linked = syncChildLinks(tasks);
  let result = linked;
  for (let pass = 0; pass < 8; pass += 1) {
    let changed = false;
    const next = result.map((task) => {
      if (task.childTaskIds.length === 0) return task;
      const children = result.filter((child) => child.parentTaskId === task.id);
      if (children.length === 0) return task;
      const allDone = children.every((child) => child.status === 'completed');
      if (allDone) {
        const completions = children
          .map((child) => child.completedAt)
          .filter((value): value is string => Boolean(value))
          .sort();
        const completedAt = completions[completions.length - 1] ?? nowIso();
        if (task.status !== 'completed' || task.completedAt !== completedAt) {
          changed = true;
          return { ...task, status: 'completed' as const, completedAt };
        }
        return task;
      }
      if (task.status === 'completed') {
        changed = true;
        return { ...task, status: 'todo' as const, completedAt: null };
      }
      return task;
    });
    result = next;
    if (!changed) break;
  }
  return syncChildLinks(result);
}

function reconcileProjects(
  projects: Project[],
  tasks: Task[],
): { projects: Project[]; completedProjectIds: string[] } {
  const completedProjectIds: string[] = [];
  const timestamp = nowIso();
  const next = projects.map((project) => {
    if (project.status === 'archived') return project;
    const actionable = leafTasks(tasks, project.id);
    if (actionable.length === 0) return project;
    const allDone = actionable.every((task) => task.status === 'completed');
    if (allDone && project.status !== 'completed') {
      completedProjectIds.push(project.id);
      return { ...project, status: 'completed' as const, completedAt: timestamp, updatedAt: timestamp };
    }
    if (!allDone && project.status === 'completed') {
      return { ...project, status: 'active' as const, completedAt: null, updatedAt: timestamp };
    }
    return project;
  });
  return { projects: next, completedProjectIds };
}

function settle(_prev: TakTicState, input: TakTicState, events: SettleEvents = {}): TakTicState {
  let state = input;
  const timestamp = nowIso();
  const transactions = [...state.xpTransactions];
  const sources = new Set(transactions.map((transaction) => transaction.source));

  const pushXp = (source: string, amount: number, label: string) => {
    if (amount <= 0 || sources.has(source)) return;
    sources.add(source);
    transactions.push({
      id: uid('xp'),
      source,
      amount,
      timestamp,
      label,
    });
  };

  for (const taskId of events.completedTaskIds ?? []) {
    const task = state.tasks.find((candidate) => candidate.id === taskId);
    if (!task || task.childTaskIds.length > 0) continue;
    pushXp(`task:${task.id}`, task.xpReward, task.title);
  }

  for (const projectId of events.completedProjectIds ?? []) {
    const project = state.projects.find((candidate) => candidate.id === projectId);
    if (!project) continue;
    pushXp(`project:${project.id}`, state.settings.xp.project, project.title);
  }

  if (events.completedSessionId) {
    const session = state.focusSessions.find(
      (candidate) => candidate.id === events.completedSessionId,
    );
    if (session && session.type === 'focus' && session.status === 'completed') {
      pushXp(`focus:${session.id}`, state.settings.xp.focus, 'Focus session');
    }
  }

  let streak = state.streak;
  if (events.activity) {
    streak = recordActivity(streak, events.activity.date, {
      tasks: events.activity.tasks,
      focusMinutes: events.activity.focusMinutes,
    });
  } else {
    streak = {
      ...streak,
      currentStreak: rebuildStreakCurrent(streak),
    };
  }

  const today = todayKey();
  let objectives =
    state.objectivesDate !== today
      ? generateObjectives(state.projects, state.tasks, state.settings.xp.objective, today)
      : state.objectives;

  const referencedMissingProject = objectives.some(
    (objective) => objective.projectId && !state.projects.some((project) => project.id === objective.projectId),
  );
  if (referencedMissingProject) {
    objectives = generateObjectives(state.projects, state.tasks, state.settings.xp.objective, today);
  }
  objectives = refreshObjectives(objectives, state.tasks, state.focusSessions, today);

  for (const objective of objectives) {
    if (objective.completed) {
      pushXp(`objective:${objective.id}`, objective.xpReward, objective.description);
    }
  }

  state = {
    ...state,
    objectives,
    objectivesDate: today,
    streak,
    xpTransactions: transactions,
  };

  const unlocked = new Set(state.achievements.map((achievement) => achievement.id));
  const newAchievements = newlyUnlockedAchievements(state, unlocked);
  const achievementRecords = [...state.achievements];
  for (const achievement of newAchievements) {
    achievementRecords.push({ id: achievement.id, unlockedAt: timestamp });
    pushXp(`achievement:${achievement.id}`, achievement.xpReward, achievement.name);
  }

  const xp = summarizeXp(transactions).total;
  const level = levelInfo(xp).level;

  return {
    ...state,
    achievements: achievementRecords,
    xpTransactions: transactions,
    profile: { ...state.profile, xp, level },
  };
}

function rebuildStreakCurrent(streak: TakTicState['streak']): number {
  const today = todayKey();
  const active = new Set(streak.activityDates.map((day) => day.date));
  let cursor = active.has(today) ? today : addDays(today, -1);
  if (!active.has(cursor)) return 0;
  let count = 0;
  while (active.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

function touchProject(projects: Project[], projectId: string): Project[] {
  const timestamp = nowIso();
  return projects.map((project) =>
    project.id === projectId ? { ...project, updatedAt: timestamp } : project,
  );
}

function applyTaskMutation(
  state: TakTicState,
  tasks: Task[],
  events: SettleEvents = {},
): TakTicState {
  const reconciledTasks = syncAndReconcileTasks(tasks);
  const { projects, completedProjectIds } = reconcileProjects(state.projects, reconciledTasks);
  const next: TakTicState = {
    ...state,
    tasks: reconciledTasks,
    projects,
  };
  return settle(state, next, {
    ...events,
    completedProjectIds: [
      ...(events.completedProjectIds ?? []),
      ...completedProjectIds,
    ],
  });
}

function cleanupDependencies(tasks: Task[], removedIds: Set<string>): Task[] {
  return tasks.map((task) => {
    const dependencies = task.dependencies.filter((id) => !removedIds.has(id));
    return dependencies.length === task.dependencies.length ? task : { ...task, dependencies };
  });
}

function startSession(state: TakTicState, action: Extract<Action, { type: 'START_SESSION' }>): TakTicState {
  if (state.activeSession) return state;
  const now = Date.now();
  const activeSession: ActiveSession = {
    id: uid('focus'),
    type: action.sessionType,
    taskId: action.taskId,
    plannedSeconds: action.plannedSeconds,
    startedAt: now,
    endsAt: now + action.plannedSeconds * 1000,
    remainingMs: null,
    status: 'running',
    focusCycleBefore: state.focusCycle,
  };
  const tasks = action.taskId
    ? state.tasks.map((task) =>
        task.id === action.taskId && task.status === 'todo'
          ? { ...task, status: 'in_progress' as const }
          : task,
      )
    : state.tasks;
  return {
    ...state,
    tasks,
    activeSession,
  };
}

function sessionElapsedSeconds(session: ActiveSession): { elapsed: number; remaining: number } {
  const remainingMs =
    session.status === 'paused'
      ? Math.max(0, session.remainingMs ?? 0)
      : Math.max(0, session.endsAt - Date.now());
  const elapsed = Math.min(
    session.plannedSeconds,
    Math.max(0, Math.round((session.plannedSeconds * 1000 - remainingMs) / 1000)),
  );
  return { elapsed, remaining: Math.round(remainingMs / 1000) };
}

function finishSession(
  state: TakTicState,
  mode: 'complete' | 'end',
): TakTicState {
  const active = state.activeSession;
  if (!active) return state;
  const { elapsed } = sessionElapsedSeconds(active);
  const completedNaturally = mode === 'complete' && elapsed >= active.plannedSeconds * 0.95;
  const isFocus = active.type === 'focus';
  const qualifies = isFocus && completedNaturally;
  const timestamp = nowIso();
  const record: FocusSession = {
    id: active.id,
    taskId: active.taskId,
    type: active.type,
    plannedSeconds: active.plannedSeconds,
    actualSeconds: completedNaturally ? active.plannedSeconds : elapsed,
    startTime: new Date(active.startedAt).toISOString(),
    endTime: timestamp,
    status: completedNaturally ? 'completed' : 'abandoned',
    xpAwarded: qualifies,
  };

  const tasks = active.taskId
    ? state.tasks.map((task) =>
        task.id === active.taskId
          ? { ...task, actualMinutes: task.actualMinutes + Math.round(record.actualSeconds / 60) }
          : task,
      )
    : state.tasks;

  const focusMinutes = qualifies ? Math.round(record.actualSeconds / 60) : 0;
  let focusCycle = state.focusCycle;
  if (qualifies) {
    focusCycle += 1;
  }
  if (completedNaturally && active.type === 'long') {
    focusCycle = 0;
  }

  const next: TakTicState = {
    ...state,
    tasks,
    focusSessions: [...state.focusSessions, record],
    activeSession: null,
    focusCycle,
    pendingReviewSessionId: isFocus ? record.id : state.pendingReviewSessionId,
  };

  return settle(state, next, {
    completedSessionId: qualifies ? record.id : undefined,
    activity: qualifies
      ? { date: todayKey(), focusMinutes, tasks: 0 }
      : undefined,
  });
}

function removeDemoData(state: TakTicState): TakTicState {
  const projects = state.projects.filter((project) => !project.isDemo);
  const tasks = syncChildLinks(state.tasks.filter((task) => !task.isDemo));
  const focusSessions = state.focusSessions.filter((session) => !session.isDemo);
  const achievements = state.achievements.filter((achievement) => !achievement.isDemo);
  const adaptations = state.adaptations.filter((record) => !record.isDemo);
  const xpTransactions = state.xpTransactions.filter((transaction) => !transaction.isDemo);
  const companionMessages = state.companionMessages.filter((message) => !message.isDemo);
  const dailyPlans = state.dailyPlans.filter(
    (plan) => !plan.blocks.some((block) => block.taskId?.startsWith('demo-')),
  );
  const streak = rebuildStreak({ tasks, focusSessions });
  const objectives = generateObjectives(projects, tasks, state.settings.xp.objective, todayKey());
  const xp = summarizeXp(xpTransactions).total;

  return prepareState({
    ...state,
    projects,
    tasks,
    focusSessions,
    achievements,
    adaptations,
    xpTransactions,
    companionMessages,
    dailyPlans,
    streak,
    objectives,
    objectivesDate: todayKey(),
    demoLoaded: false,
    activeSession: state.activeSession?.taskId?.startsWith('demo-') ? null : state.activeSession,
    pendingReviewSessionId: null,
    profile: { ...state.profile, xp, level: levelInfo(xp).level },
  });
}

export function reducer(state: TakTicState, action: Action): TakTicState {
  switch (action.type) {
    case 'ADD_PROJECT': {
      return { ...state, projects: [...state.projects, action.project] };
    }

    case 'UPDATE_PROJECT': {
      const projects = state.projects.map((project) =>
        project.id === action.id
          ? {
              ...project,
              ...action.patch,
              id: project.id,
              updatedAt: nowIso(),
              completedAt:
                action.patch.status === 'completed'
                  ? project.completedAt ?? nowIso()
                  : action.patch.status === 'active'
                    ? null
                    : project.completedAt,
            }
          : project,
      );
      return settle(state, { ...state, projects });
    }

    case 'DELETE_PROJECT': {
      const removedTaskIds = new Set(
        state.tasks.filter((task) => task.projectId === action.id).map((task) => task.id),
      );
      const tasks = cleanupDependencies(
        state.tasks.filter((task) => task.projectId !== action.id),
        removedTaskIds,
      );
      const adaptations = state.adaptations.filter((record) => !removedTaskIds.has(record.taskId));
      const next: TakTicState = {
        ...state,
        projects: state.projects.filter((project) => project.id !== action.id),
        tasks: syncChildLinks(tasks),
        adaptations,
        objectives: state.objectives.filter((objective) => objective.projectId !== action.id),
      };
      return settle(state, next);
    }

    case 'ADD_TASK': {
      const tasks = [...state.tasks, action.task];
      return applyTaskMutation(
        { ...state, projects: touchProject(state.projects, action.task.projectId) },
        tasks,
      );
    }

    case 'ADD_TASKS': {
      const tasks = [...state.tasks, ...action.tasks];
      return applyTaskMutation(
        { ...state, projects: touchProject(state.projects, action.projectId) },
        tasks,
      );
    }

    case 'UPDATE_TASK': {
      const original = state.tasks.find((task) => task.id === action.id);
      if (!original) return state;
      const hasXp = state.xpTransactions.some(
        (transaction) => transaction.source === `task:${action.id}`,
      );
      const patch = { ...action.patch };
      delete patch.status;
      delete patch.completedAt;
      delete patch.id;
      delete patch.childTaskIds;
      delete patch.projectId;
      delete patch.parentTaskId;

      const difficulty = patch.difficulty ?? original.difficulty;
      const xpReward = hasXp
        ? original.xpReward
        : patch.xpReward ?? state.settings.xp[difficulty];

      const tasks = state.tasks.map((task) =>
        task.id === action.id
          ? {
              ...task,
              ...patch,
              difficulty,
              xpReward: Math.max(0, Math.round(xpReward)),
            }
          : task,
      );
      return applyTaskMutation(
        { ...state, projects: touchProject(state.projects, original.projectId) },
        tasks,
      );
    }

    case 'SET_BLOCKED': {
      const tasks = state.tasks.map((task) =>
        task.id === action.id
          ? {
              ...task,
              status: action.blocked
                ? ('blocked' as const)
                : task.status === 'blocked'
                  ? ('todo' as const)
                  : task.status,
              blockedReason: action.blocked ? action.reason?.trim() || 'Marked as blocked' : null,
            }
          : task,
      );
      return applyTaskMutation(state, tasks);
    }

    case 'DELETE_TASK': {
      const removed = new Set([
        action.id,
        ...descendantsOf(state.tasks, action.id).map((task) => task.id),
      ]);
      const original = state.tasks.find((task) => task.id === action.id);
      const tasks = cleanupDependencies(
        state.tasks.filter((task) => !removed.has(task.id)),
        removed,
      );
      const adaptations = state.adaptations.filter((record) => !removed.has(record.taskId));
      return applyTaskMutation(
        {
          ...state,
          adaptations,
          projects: original ? touchProject(state.projects, original.projectId) : state.projects,
        },
        tasks,
      );
    }

    case 'TOGGLE_TASK': {
      const task = state.tasks.find((candidate) => candidate.id === action.id);
      if (!task) return state;
      const completing = task.status !== 'completed';
      const descendants = descendantsOf(state.tasks, task.id);
      const hasChildren = descendants.length > 0;

      if (hasChildren && !completing) {
        return state;
      }
      if (hasChildren && completing && !action.cascade) {
        return state;
      }

      const targets = new Set<string>([task.id]);
      if (hasChildren) {
        for (const child of descendants) targets.add(child.id);
      }
      const timestamp = nowIso();
      const newlyCompleted: string[] = [];

      const tasks = state.tasks.map((candidate) => {
        if (!targets.has(candidate.id)) return candidate;
        if (completing) {
          if (candidate.status === 'completed') return candidate;
          if (descendantsOf(state.tasks, candidate.id).length === 0) {
            newlyCompleted.push(candidate.id);
          }
          return { ...candidate, status: 'completed' as const, completedAt: timestamp };
        }
        return { ...candidate, status: 'todo' as const, completedAt: null };
      });

      const ancestors = new Map<string, Task>();
      let parentId = task.parentTaskId;
      while (parentId) {
        const parent = state.tasks.find((candidate) => candidate.id === parentId);
        if (!parent) break;
        ancestors.set(parent.id, parent);
        parentId = parent.parentTaskId;
      }

      const withAncestors = tasks.map((candidate) => {
        if (!ancestors.has(candidate.id) || completing) return candidate;
        return { ...candidate, status: 'todo' as const, completedAt: null };
      });

      return applyTaskMutation(state, withAncestors, {
        completedTaskIds: completing ? newlyCompleted : [],
        activity: completing ? { date: todayKey(), tasks: newlyCompleted.length } : undefined,
      });
    }

    case 'MOVE_TASK': {
      const task = state.tasks.find((candidate) => candidate.id === action.id);
      if (!task) return state;
      const descendants = descendantsOf(state.tasks, action.id);
      if (
        action.parentTaskId === action.id ||
        descendants.some((descendant) => descendant.id === action.parentTaskId)
      ) {
        return state;
      }
      const targetProject = state.projects.find((project) => project.id === action.projectId);
      if (!targetProject) return state;

      const tasks = state.tasks.map((candidate) => {
        if (candidate.id === action.id) {
          return {
            ...candidate,
            projectId: action.projectId,
            parentTaskId: action.parentTaskId,
            order: Date.now(),
          };
        }
        if (descendants.some((descendant) => descendant.id === candidate.id)) {
          return { ...candidate, projectId: action.projectId };
        }
        return candidate;
      });

      let projects = touchProject(state.projects, action.projectId);
      if (task.projectId !== action.projectId) {
        projects = touchProject(projects, task.projectId);
      }
      return applyTaskMutation({ ...state, projects }, tasks);
    }

    case 'DUPLICATE_TASK': {
      const original = state.tasks.find((task) => task.id === action.id);
      if (!original) return state;
      const subtree = [original, ...descendantsOf(state.tasks, action.id)];
      const idMap = new Map<string, string>();
      for (const task of subtree) idMap.set(task.id, uid('task'));
      const timestamp = nowIso();
      const copies: Task[] = subtree.map((task, index) => ({
        ...task,
        id: idMap.get(task.id) as string,
        parentTaskId: task.parentTaskId ? idMap.get(task.parentTaskId) ?? null : null,
        title: `${task.title} (copy)`,
        status: 'todo' as const,
        completedAt: null,
        createdAt: timestamp,
        order: original.order + index + 1,
        dependencies: task.dependencies
          .map((id) => idMap.get(id))
          .filter((id): id is string => Boolean(id)),
        childTaskIds: [],
        actualMinutes: 0,
        deadline: task.deadline,
        isDemo: false,
      }));
      const tasks = [...state.tasks, ...copies];
      return applyTaskMutation(
        { ...state, projects: touchProject(state.projects, original.projectId) },
        tasks,
      );
    }

    case 'REORDER_TASK': {
      const task = state.tasks.find((candidate) => candidate.id === action.id);
      if (!task) return state;
      const siblings = state.tasks
        .filter(
          (candidate) =>
            candidate.parentTaskId === task.parentTaskId &&
            candidate.projectId === task.projectId,
        )
        .sort((a, b) => a.order - b.order);
      const index = siblings.findIndex((candidate) => candidate.id === task.id);
      const swapWith = action.direction === 'up' ? index - 1 : index + 1;
      if (index < 0 || swapWith < 0 || swapWith >= siblings.length) return state;
      const reordered = [...siblings];
      const temp = reordered[index];
      reordered[index] = reordered[swapWith];
      reordered[swapWith] = temp;
      const orderMap = new Map(reordered.map((candidate, orderIndex) => [candidate.id, orderIndex * 10]));
      const tasks = state.tasks.map((candidate) =>
        orderMap.has(candidate.id)
          ? { ...candidate, order: orderMap.get(candidate.id) as number }
          : candidate,
      );
      return applyTaskMutation(state, tasks);
    }

    case 'APPLY_ADAPTATION': {
      const parent = state.tasks.find((task) => task.id === action.taskId);
      if (!parent) return state;
      const timestamp = nowIso();
      const existingChildren = state.tasks.filter((task) => task.parentTaskId === parent.id);
      const startOrder =
        existingChildren.length > 0
          ? Math.max(...existingChildren.map((task) => task.order)) + 10
          : 10;
      const newTasks = action.subtasks.map((draft, index) =>
        buildTask({
          projectId: parent.projectId,
          parentTaskId: parent.id,
          title: draft.title,
          description: draft.description,
          estimatedMinutes: draft.estimatedMinutes,
          difficulty: draft.difficulty,
          priority: parent.priority,
          order: startOrder + index * 10,
          createdAt: timestamp,
          xp: state.settings.xp,
        }),
      );

      const tasks = state.tasks
        .map((task) =>
          task.id === parent.id
            ? {
                ...task,
                lastAdaptedAt: timestamp,
                estimatedMinutes:
                  action.revisedEstimateMinutes ?? task.estimatedMinutes,
                ...(action.reframedTask
                  ? {
                      title: action.reframedTask.title || task.title,
                      description: action.reframedTask.description,
                    }
                  : {}),
              }
            : task,
        )
        .concat(newTasks);

      const adaptations = [...state.adaptations, action.record];
      return applyTaskMutation(
        {
          ...state,
          adaptations,
          projects: touchProject(state.projects, parent.projectId),
        },
        tasks,
      );
    }

    case 'START_SESSION':
      return startSession(state, action);

    case 'PAUSE_SESSION': {
      const active = state.activeSession;
      if (!active || active.status === 'paused') return state;
      const remainingMs = Math.max(0, active.endsAt - Date.now());
      return {
        ...state,
        activeSession: {
          ...active,
          status: 'paused',
          remainingMs,
        },
      };
    }

    case 'RESUME_SESSION': {
      const active = state.activeSession;
      if (!active || active.status !== 'paused') return state;
      const remaining = active.remainingMs ?? active.plannedSeconds * 1000;
      return {
        ...state,
        activeSession: {
          ...active,
          status: 'running',
          endsAt: Date.now() + remaining,
          remainingMs: null,
        },
      };
    }

    case 'RESET_SESSION': {
      const active = state.activeSession;
      if (!active) return state;
      return {
        ...state,
        activeSession: {
          ...active,
          startedAt: Date.now(),
          endsAt: Date.now() + active.plannedSeconds * 1000,
          remainingMs: null,
          status: 'running',
        },
      };
    }

    case 'SET_SESSION_TASK': {
      const active = state.activeSession;
      if (!active) return state;
      return { ...state, activeSession: { ...active, taskId: action.taskId } };
    }

    case 'COMPLETE_SESSION': {
      const active = state.activeSession;
      if (!active || active.status !== 'running') return state;
      if (Date.now() + 250 < active.endsAt) return state;
      return finishSession(state, 'complete');
    }

    case 'END_SESSION':
      return finishSession(state, 'end');

    case 'DISMISS_REVIEW':
      return { ...state, pendingReviewSessionId: null };

    case 'UPDATE_SESSION_NOTES': {
      return {
        ...state,
        focusSessions: state.focusSessions.map((session) =>
          session.id === action.sessionId ? { ...session, notes: action.notes } : session,
        ),
      };
    }

    case 'UPDATE_PROFILE': {
      return {
        ...state,
        profile: {
          ...state.profile,
          ...action.patch,
          displayName: action.patch.displayName?.trim() || state.profile.displayName,
        },
      };
    }

    case 'UPDATE_PREFERENCES': {
      return {
        ...state,
        profile: {
          ...state.profile,
          preferences: { ...state.profile.preferences, ...action.patch },
        },
      };
    }

    case 'UPDATE_SETTINGS': {
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.patch,
          dashboard: action.patch.dashboard ?? state.settings.dashboard,
          focus: action.patch.focus ?? state.settings.focus,
          ai: action.patch.ai ?? state.settings.ai,
          notifications: action.patch.notifications ?? state.settings.notifications,
          xp: action.patch.xp ?? state.settings.xp,
          planner: action.patch.planner ?? state.settings.planner,
        },
      };
    }

    case 'REFRESH_DAY': {
      const prepared = prepareState(state);
      return settle(state, prepared);
    }

    case 'LOAD_DEMO': {
      const demo = createDemoState();
      const today = todayKey();
      return prepareState({
        ...demo,
        settings: state.settings,
        profile: {
          ...demo.profile,
          displayName: state.profile.displayName === 'Student' ? demo.profile.displayName : state.profile.displayName,
          preferences: state.profile.preferences,
        },
        objectivesDate: today,
      });
    }

    case 'REMOVE_DEMO':
      return removeDemoData(state);

    case 'RESET':
      return createInitialState();

    case 'IMPORT_STATE':
      return prepareState(action.state);

    case 'RESTORE_STATE':
      return prepareState(action.state);

    case 'ADD_COMPANION_MESSAGE': {
      const messages = [...state.companionMessages, action.message].slice(-60);
      return { ...state, companionMessages: messages };
    }

    case 'CLEAR_COMPANION':
      return { ...state, companionMessages: [] };

    case 'SAVE_PLAN': {
      const plans = state.dailyPlans.filter((plan) => plan.date !== action.plan.date);
      return settle(state, { ...state, dailyPlans: [...plans, action.plan] });
    }

    case 'DELETE_PLAN':
      return {
        ...state,
        dailyPlans: state.dailyPlans.filter((plan) => plan.id !== action.id),
      };

    default:
      return state;
  }
}

export function totalXp(state: TakTicState): number {
  return xpFromLedger(state);
}

/** Re-exported so the focus room can render projected elapsed time consistently. */
export function activeSessionProgress(session: ActiveSession): {
  elapsed: number;
  remaining: number;
  percent: number;
} {
  const { elapsed, remaining } = sessionElapsedSeconds(session);
  return {
    elapsed,
    remaining,
    percent:
      session.plannedSeconds === 0
        ? 0
        : Math.min(100, Math.round((elapsed / session.plannedSeconds) * 100)),
  };
}

export type { PlanBlock, FeedbackType, DailyPlan, TaskDraft };
