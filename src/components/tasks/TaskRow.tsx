import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  LifeBuoy,
  Lock,
  PencilLine,
  Play,
  Plus,
  Trash2,
  Wand2,
} from 'lucide-react';
import type { Task } from '../../types';
import { useTakTic } from '../../store/TakTicProvider';
import { useToast } from '../ui/ToastProvider';
import { useAppActions } from '../app/AppActionsProvider';
import { Dropdown } from '../ui/Dropdown';
import { ConfirmDialog } from '../ui/Modal';
import { DifficultyBadge, PriorityBadge, StatusPill, TaskCount } from '../ui/Badges';
import { InlineDeadline, InlineDuration } from './InlineTaskTime';
import { ProgressBar } from '../ui/Feedback';
import { cn } from '../../utils/cn';
import {
  childrenOf,
  descendantsOf,
  incompleteDependencies,
} from '../../utils/tasks';

interface TaskRowProps {
  task: Task;
  depth?: number;
  showProject?: boolean;
  compact?: boolean;
  flat?: boolean;
}

interface CompletionPrompt {
  kind: 'cascade' | 'override';
  cascadeCount?: number;
  dependencies: Task[];
  blocked: boolean;
}

export function TaskRow({
  task,
  depth = 0,
  showProject = true,
  compact = false,
  flat = false,
}: TaskRowProps) {
  const { state, stats, dispatch, captureSnapshot, offerUndo } = useTakTic();
  const { toast } = useToast();
  const { openTask, openDecompose, openUnstuck } = useAppActions();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(depth < 1);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [prompt, setPrompt] = useState<CompletionPrompt | null>(null);

  const children = useMemo(() => childrenOf(state.tasks, task.id), [state.tasks, task.id]);
  const hasChildren = children.length > 0;
  const project = state.projects.find((candidate) => candidate.id === task.projectId);
  const completedChildren = children.filter((child) => child.status === 'completed').length;
  const dependencies = useMemo(
    () => incompleteDependencies(task, state.tasks),
    [task, state.tasks],
  );

  const completed = task.status === 'completed';
  const blocked = task.status === 'blocked';
  const isNextStep = !completed && stats.nextTask?.id === task.id;
  const siblings = state.tasks
    .filter(
      (candidate) =>
        candidate.parentTaskId === task.parentTaskId &&
        candidate.projectId === task.projectId,
    )
    .sort((a, b) => a.order - b.order);
  const siblingIndex = siblings.findIndex((candidate) => candidate.id === task.id);

  const moveTask = (direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? siblingIndex - 1 : siblingIndex + 1;
    const other = siblings[swapIndex];
    if (!other) return;
    const needsOther =
      (direction === 'up' && task.dependencies.includes(other.id)) ||
      (direction === 'down' && other.dependencies.includes(task.id));
    if (needsOther) {
      toast({
        title: 'Keep the working order',
        description: `“${other.title}” has to come first for this task.`,
        tone: 'error',
      });
      return;
    }
    dispatch({ type: 'REORDER_TASK', id: task.id, direction });
  };

  const handleToggle = () => {
    if (hasChildren) {
      if (completed) return;
      const openDescendants = descendantsOf(state.tasks, task.id).filter(
        (child) => child.status !== 'completed',
      );
      setPrompt({ kind: 'cascade', cascadeCount: openDescendants.length, dependencies: [], blocked });
      return;
    }
    if (completed) {
      dispatch({ type: 'TOGGLE_TASK', id: task.id });
      toast({ title: 'Task reopened', description: task.title, duration: 2800 });
      return;
    }
    if (dependencies.length > 0 || blocked) {
      setPrompt({ kind: 'override', dependencies, blocked });
      return;
    }
    dispatch({ type: 'TOGGLE_TASK', id: task.id });
  };

  const confirmCompletion = () => {
    if (!prompt) return;
    dispatch({
      type: 'TOGGLE_TASK',
      id: task.id,
      cascade: prompt.kind === 'cascade',
    });
    setPrompt(null);
  };

  const handleDelete = () => {
    const snapshot = captureSnapshot();
    dispatch({ type: 'DELETE_TASK', id: task.id });
    setDeleteOpen(false);
    offerUndo(
      'Task deleted',
      snapshot,
      hasChildren ? 'The task and its subtasks were removed.' : 'The task was removed.',
    );
  };

  const handleDuplicate = () => {
    dispatch({ type: 'DUPLICATE_TASK', id: task.id });
    toast({ title: 'Task duplicated', description: task.title, tone: 'success' });
  };

  const toggleBlocked = () => {
    const snapshot = captureSnapshot();
    dispatch({
      type: 'SET_BLOCKED',
      id: task.id,
      blocked: !blocked,
      reason: blocked ? undefined : 'Marked as blocked — edit the task to add a reason.',
    });
    if (blocked) {
      toast({ title: 'Task unblocked', description: task.title, tone: 'success' });
    } else {
      offerUndo('Task marked as blocked', snapshot, 'You can still work on it at any time.');
    }
  };

  const menuItems = [
    {
      label: 'Edit task',
      icon: PencilLine,
      onSelect: () => openTask({ taskId: task.id }),
    },
    {
      label: 'Add a subtask',
      icon: Plus,
      onSelect: () => openTask({ taskId: null, projectId: task.projectId, parentTaskId: task.id }),
    },
    {
      label: 'Split further',
      icon: Wand2,
      onSelect: () => openDecompose({ taskId: task.id }),
    },
    ...(hasChildren && !completed
      ? [
          {
            label: 'Complete all subtasks',
            icon: Check,
            onSelect: () => {
              const openDescendants = descendantsOf(state.tasks, task.id).filter(
                (child) => child.status !== 'completed',
              );
              setPrompt({
                kind: 'cascade',
                cascadeCount: openDescendants.length,
                dependencies: [],
                blocked,
              });
            },
          },
        ]
      : []),
    ...(!hasChildren && !completed
      ? [
          {
            label: 'Having trouble?',
            icon: LifeBuoy,
            onSelect: () => openUnstuck({ taskId: task.id }),
          },
          {
            label: 'Start focus timer',
            icon: Play,
            onSelect: () => navigate(`/focus?task=${task.id}`),
          },
        ]
      : []),
    {
      label: 'Move up',
      icon: ArrowUp,
      onSelect: () => moveTask('up'),
    },
    {
      label: 'Move down',
      icon: ArrowDown,
      onSelect: () => moveTask('down'),
    },
    {
      label: 'Duplicate',
      icon: Copy,
      onSelect: handleDuplicate,
    },
    {
      label: blocked ? 'Remove blocked mark' : 'Mark as blocked',
      icon: Lock,
      onSelect: toggleBlocked,
    },
    {
      label: 'Delete task',
      icon: Trash2,
      onSelect: () => setDeleteOpen(true),
      danger: true,
      separatorBefore: true,
    },
  ];

  const parentPercent = hasChildren
    ? Math.round(
        (descendantsOf(state.tasks, task.id).filter((child) => child.status === 'completed').length /
          Math.max(1, descendantsOf(state.tasks, task.id).length)) *
          100,
      )
    : 0;

  return (
    <div id={`task-${task.id}`} className="scroll-mt-24">
      <div
        className={cn(
          'group relative flex items-start gap-2 rounded-[11px] border transition-[border-color,background-color,box-shadow] duration-200 md:gap-3',
          compact ? 'mx-2 my-1.5 px-3 py-2.5' : 'mx-2 my-2 px-3 py-3 md:px-3.5',
          completed
            ? 'border-line/55 bg-surface2/25'
            : blocked
              ? 'border-accent/30 bg-accent-soft/20'
              : 'border-line/75 bg-paper hover:border-ink/20 hover:shadow-paper',
        )}
      >
        <span
          className={cn(
            'absolute inset-y-3 left-0 w-[2px] rounded-full',
            task.priority === 'urgent'
              ? 'bg-danger'
              : task.priority === 'high'
                ? 'bg-warning/80'
                : task.priority === 'medium'
                  ? 'bg-sage/60'
                  : 'bg-line',
          )}
          aria-hidden
        />
        <div className="flex shrink-0 items-start gap-0.5 pt-0.5">
          {hasChildren && !flat ? (
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="flex h-5 w-5 items-center justify-center text-muted transition-colors hover:text-ink"
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse subtasks' : 'Expand subtasks'}
            >
              {expanded ? (
                <ChevronDown size={14} aria-hidden />
              ) : (
                <ChevronRight size={14} aria-hidden />
              )}
            </button>
          ) : (
            <span className="h-5 w-5" aria-hidden />
          )}

          {hasChildren ? (
            <span
              className={cn(
                'mt-[3px] flex h-[17px] w-[17px] items-center justify-center rounded-[4px] border',
                completed ? 'border-sage bg-sage text-paper' : 'border-line bg-paper',
              )}
              title={completed ? 'All subtasks complete' : `${completedChildren} of ${children.length} subtasks complete`}
              aria-hidden
            >
              {completed ? <Check size={10} strokeWidth={3} /> : null}
            </span>
          ) : (
            <button
              type="button"
              role="checkbox"
              aria-checked={completed}
              aria-label={completed ? `Reopen ${task.title}` : `Complete ${task.title}`}
              onClick={handleToggle}
              className={cn(
                'relative mt-[3px] flex h-[17px] w-[17px] items-center justify-center rounded-[4px] border transition-colors before:absolute before:-inset-3 before:content-[""]',
                completed
                  ? 'border-sage bg-sage text-paper'
                  : 'border-muted/45 bg-paper hover:border-accent hover:bg-accent-soft/30',
              )}
            >
              <AnimatePresence>
                {completed ? (
                  <motion.svg
                    key="completed-check"
                    viewBox="0 0 12 12"
                    className="h-[11px] w-[11px]"
                    fill="none"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.16 }}
                    aria-hidden
                  >
                    <motion.path
                      d="M2.2 6.2 4.8 8.8 9.8 3.2"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.24, ease: 'easeOut' }}
                    />
                  </motion.svg>
                ) : null}
              </AnimatePresence>
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={() => openTask({ taskId: task.id })}
              className={cn(
                'min-w-0 flex-1 text-left text-[14px] leading-5 transition-colors hover:text-accent sm:text-[15px]',
                completed ? 'text-muted line-through decoration-muted/40' : 'text-ink',
              )}
            >
              {task.title}
            </button>
            <div className="flex shrink-0 items-center gap-0.5">
              {!completed && !compact ? (
                <button
                  type="button"
                  onClick={() => openUnstuck({ taskId: task.id })}
                  className="flex items-center gap-1 rounded-[4px] px-1 py-0.5 text-[12px] text-muted transition-colors hover:bg-accent/10 hover:text-accent"
                  title="Having trouble? Adapt this task"
                  aria-label="Having trouble? Adapt this task"
                >
                  <LifeBuoy size={12} aria-hidden />
                  <span className="hidden sm:inline">Having trouble?</span>
                </button>
              ) : null}
              <Dropdown items={menuItems} label={`Actions for ${task.title}`} />
            </div>
          </div>

          <div className={cn('flex flex-wrap items-center gap-y-1.5', compact ? 'mt-1 gap-x-2' : 'mt-1.5 gap-x-3')}>
            {showProject ? (
              project ? (
                <Link
                  to={`/projects/${project.id}`}
                  className="inline-flex items-center gap-1.5 text-[12px] text-muted transition-colors hover:text-ink"
                  onClick={(event) => event.stopPropagation()}
                >
                  <span className="h-1 w-1 rounded-full bg-accent" aria-hidden />
                  <span className={cn('truncate', compact ? 'max-w-[140px]' : 'max-w-[180px]')}>
                    {project.title}
                  </span>
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
                  <span className="h-1 w-1 rounded-full bg-line" aria-hidden />
                  Personal
                </span>
              )
            ) : null}
            <InlineDuration task={task} />
            {!compact ? <PriorityBadge priority={task.priority} /> : null}
            {!compact ? <DifficultyBadge difficulty={task.difficulty} /> : null}
            <InlineDeadline task={task} />
            {hasChildren ? (
              <>
                <TaskCount count={children.length} />
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                  <span className="w-10">
                    <ProgressBar value={parentPercent} height="sm" tone={completed ? 'sage' : 'accent'} label="Subtask progress" />
                  </span>
                  <span className="font-mono">{parentPercent}%</span>
                </span>
              </>
            ) : null}
            {blocked ? (
              <span
                className="inline-flex items-center gap-1 text-[12px] text-warning"
                title={task.blockedReason ?? 'Marked as blocked'}
              >
                <Lock size={10} aria-hidden />
                Blocked
              </span>
            ) : null}
            {isNextStep ? (
              <span className="inline-flex items-center gap-1 rounded-[6px] bg-accent/10 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-accent">
                <Play size={9} aria-hidden />
                Start here
              </span>
            ) : null}
            {task.lastAdaptedAt ? (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted/80">
                <Wand2 size={9} aria-hidden />
                adapted
              </span>
            ) : null}
            {task.status === 'in_progress' && !completed ? (
              <StatusPill tone="accent">in progress</StatusPill>
            ) : null}
            {dependencies.length > 0 && !completed ? (
              <span className="inline-flex items-center gap-1 text-[12px] text-warning" title={`Waiting on: ${dependencies.map((dependency) => dependency.title).join(', ')}`}>
                <AlertTriangle size={10} aria-hidden />
                Waiting on {dependencies.length === 1 ? dependencies[0].title : `${dependencies.length} tasks`}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {hasChildren && expanded && !flat ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="ml-4 border-l border-line/60 pl-0.5 sm:ml-6">
              {children.map((child) => (
                <TaskRow
                  key={child.id}
                  task={child}
                  depth={depth + 1}
                  showProject={false}
                  compact={compact}
                />
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <ConfirmDialog
        open={Boolean(prompt)}
        onClose={() => setPrompt(null)}
        onConfirm={confirmCompletion}
        title={
          prompt?.kind === 'cascade'
            ? 'Complete this whole branch?'
            : prompt?.blocked
              ? 'This task is marked blocked'
              : 'Dependencies are not complete'
        }
        description={
          prompt?.kind === 'cascade' ? (
            <>
              This will mark {prompt.cascadeCount} open subtask
              {prompt.cascadeCount === 1 ? '' : 's'} complete along with the parent task. Reopen a
              subtask afterwards to undo this at task level. XP earned earlier is never removed.
            </>
          ) : prompt?.blocked ? (
            <>
              {task.blockedReason ?? 'You marked this task as blocked.'} You can still complete
              it — the block is a note, not a wall.
            </>
          ) : (
            <>These tasks are still open and this task depends on them.</>
          )
        }
        confirmLabel={
          prompt?.kind === 'cascade'
            ? 'Complete all'
            : prompt?.blocked
              ? 'Complete anyway'
              : 'Work on it anyway'
        }
      >
        {prompt?.kind !== 'cascade' && prompt?.dependencies.length ? (
          <ul className="mt-3 space-y-1 border-l-2 border-accent/40 pl-3">
            {prompt.dependencies.map((dependency) => (
              <li key={dependency.id} className="text-[14px] text-ink/80">
                {dependency.title}
              </li>
            ))}
          </ul>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete this task?"
        description={
          hasChildren
            ? 'The task and all of its subtasks will be removed. XP already earned stays in your ledger.'
            : 'The task will be removed. You can undo this straight away.'
        }
        confirmLabel="Delete task"
        tone="danger"
      />
    </div>
  );
}
