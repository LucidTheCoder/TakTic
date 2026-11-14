import type { DailyPlan, PlanBlock, Priority, Task } from '../../types';
import {
  diffCalendarDays,
  isOverdue,
  isoFromDateAndTime,
  toDateKey,
  todayKey,
} from '../../utils/date';
import { PRIORITY_ORDER, incompleteDependencies, openLeaves } from '../../utils/tasks';
import { uid } from '../../utils/id';

export interface CatchUpPostponed {
  task: Task;
  reason: string;
}

export interface CatchUpBlocked {
  task: Task;
  waitingOn: Task[];
  reason: string;
}

export interface CatchUpResult {
  plan: Omit<DailyPlan, 'id' | 'createdAt'>;
  postponed: CatchUpPostponed[];
  blocked: CatchUpBlocked[];
  startableCount: number;
  overdueCount: number;
  dueSoonCount: number;
  totalFocus: number;
  rationales: Record<string, string>;
}

function clock(minutes: number): string {
  const safe = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function dueRank(task: Task): number {
  if (!task.deadline) return Number.MAX_SAFE_INTEGER;
  return diffCalendarDays(todayKey(), toDateKey(task.deadline));
}

function rationaleFor(task: Task, allTasks: Task[]): string {
  if (task.deadline && isOverdue(task.deadline, task.deadlineHasTime, false)) {
    return 'it is past due and can actually be worked on now';
  }
  const days = dueRank(task);
  if (days === 0) return 'it is due today';
  if (days > 0 && days <= 1) return 'its deadline is closest among ready work';
  const unlocks = allTasks.filter(
    (candidate) =>
      candidate.id !== task.id &&
      candidate.status !== 'completed' &&
      candidate.dependencies.includes(task.id),
  ).length;
  if (unlocks > 0) {
    return `finishing it opens ${unlocks} later step${unlocks === 1 ? '' : 's'}`;
  }
  if (task.priority === 'urgent' || task.priority === 'high') {
    return `it is marked ${task.priority} priority`;
  }
  return 'it is ready and fits the time you have';
}

/**
 * A deterministic recovery plan. It only schedules tasks with every
 * prerequisite complete, fits focus blocks into the real window, and records
 * why everything else was left alone. It never moves or rewrites a task.
 */
export function buildCatchUpPlan(input: {
  tasks: Task[];
  availableMinutes: number;
  startHour: number;
  focusMinutes: number;
}): CatchUpResult {
  const today = todayKey();
  const open = openLeaves(input.tasks);
  const blocked: CatchUpBlocked[] = [];
  const startable: Task[] = [];

  for (const task of open) {
    const waitingOn = incompleteDependencies(task, input.tasks);
    if (waitingOn.length > 0) {
      blocked.push({
        task,
        waitingOn,
        reason: `Waiting on ${waitingOn.map((dependency) => dependency.title).join(' and ')}.`,
      });
    } else if (task.status === 'blocked') {
      blocked.push({
        task,
        waitingOn: [],
        reason: task.blockedReason ?? 'You marked this task as blocked.',
      });
    } else {
      startable.push(task);
    }
  }

  const prio = (task: Task) => PRIORITY_ORDER[task.priority as Priority];
  const startHour = Math.max(0, Math.min(23, Math.round(input.startHour)));
  const availableMinutes = Math.max(15, Math.min(720, Math.round(input.availableMinutes)));
  const focusMinutes = Math.max(5, Math.min(90, Math.round(input.focusMinutes)));
  const cursorLimit = Math.min(24 * 60, startHour * 60 + availableMinutes);
  const limit = cursorLimit;
  let cursor = startHour * 60;
  let focusRun = 0;
  let totalFocus = 0;
  const blocks: PlanBlock[] = [];
  const rationales: Record<string, string> = {};
  const scheduled = new Set<string>();

  const ranked = [...startable].sort((a, b) => {
    const aOverdue = a.deadline ? isOverdue(a.deadline, a.deadlineHasTime, false) : false;
    const bOverdue = b.deadline ? isOverdue(b.deadline, b.deadlineHasTime, false) : false;
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    const aDays = dueRank(a);
    const bDays = dueRank(b);
    if (aDays !== bDays) return aDays - bDays;
    if (prio(a) !== prio(b)) return prio(a) - prio(b);
    if ((a.scheduledDate === today) !== (b.scheduledDate === today)) {
      return a.scheduledDate === today ? -1 : 1;
    }
    const aUnlocks = input.tasks.filter(
      (candidate) => candidate.status !== 'completed' && candidate.dependencies.includes(a.id),
    ).length;
    const bUnlocks = input.tasks.filter(
      (candidate) => candidate.status !== 'completed' && candidate.dependencies.includes(b.id),
    ).length;
    if (aUnlocks !== bUnlocks) return bUnlocks - aUnlocks;
    return a.estimatedMinutes - b.estimatedMinutes || a.order - b.order;
  });

  for (const task of ranked) {
    const length = Math.max(5, Math.min(focusMinutes, task.estimatedMinutes));
    if (cursor + length > limit) continue;

    const start = cursor;
    const end = start + length;
    blocks.push({
      id: uid('block'),
      kind: 'focus',
      start: isoFromDateAndTime(today, clock(start)),
      end: isoFromDateAndTime(today, clock(end)),
      taskId: task.id,
      label: task.title,
      minutes: length,
    });
    cursor = end;
    totalFocus += length;
    focusRun += 1;
    scheduled.add(task.id);
    rationales[task.id] = rationaleFor(task, input.tasks);

    const breakLength = focusRun % 4 === 0 ? 15 : 5;
    if (cursor + breakLength <= limit) {
      const breakEnd = cursor + breakLength;
      blocks.push({
        id: uid('block'),
        kind: breakLength === 15 ? 'longBreak' : 'break',
        start: isoFromDateAndTime(today, clock(cursor)),
        end: isoFromDateAndTime(today, clock(breakEnd)),
        taskId: null,
        label: breakLength === 15 ? 'Long break' : 'Short break',
        minutes: breakLength,
      });
      cursor = breakEnd;
    }
  }

  const postponed: CatchUpPostponed[] = ranked
    .filter((task) => !scheduled.has(task.id))
    .map((task) => {
      const left = Math.max(0, limit - cursor);
      return {
        task,
        reason:
          left < 5
            ? 'There is no focus time left in this window after the blocks above.'
            : `It did not fit into the remaining ${left} minute${left === 1 ? '' : 's'} after earlier work.`,
      };
    });

  const first = ranked.find((task) => scheduled.has(task.id));
  const focusCount = blocks.filter((block) => block.kind === 'focus').length;
  const dueSoonCount = startable.filter((task) => {
    const days = dueRank(task);
    return days >= 0 && days <= 3;
  }).length;
  const overdueCount = open.filter(
    (task) => task.deadline && isOverdue(task.deadline, task.deadlineHasTime, false),
  ).length;

  const summary = focusCount === 0
    ? 'There is not a realistic focus block in this window. That is a fact about the time, not a failure. Extend the window, or make one task smaller first.'
    : `${focusCount} focus block${focusCount === 1 ? '' : 's'} in ${totalFocus} minutes, with breaks. Start with “${first?.title}” because ${first ? rationaleFor(first, input.tasks) : 'it is ready'}. ${postponed.length === 0 ? 'Everything startable fits today.' : `${postponed.length} startable step${postponed.length === 1 ? ' stays' : 's stay'} for later.`} ${blocked.length > 0 ? `${blocked.length} step${blocked.length === 1 ? ' is' : 's are'} waiting on prerequisites.` : ''}`;

  return {
    plan: {
      date: today,
      startTime: `${String(startHour).padStart(2, '0')}:00`,
      availableMinutes,
      blocks,
      summary,
      source: 'rule-based',
    },
    postponed,
    blocked,
    startableCount: startable.length,
    overdueCount,
    dueSoonCount,
    totalFocus,
    rationales,
  };
}
