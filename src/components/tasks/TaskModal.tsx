import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LifeBuoy, Sparkles, Trash2, Wand2 } from 'lucide-react';
import type { Difficulty, Priority, Task } from '../../types';
import { useTakTic } from '../../store/TakTicProvider';
import { useToast } from '../ui/ToastProvider';
import { Modal, ConfirmDialog } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Input, Select, Textarea } from '../ui/Form';
import { Segmented } from '../ui/Tabs';
import { InlineNote, Spinner } from '../ui/Feedback';
import { PriorityBadge, StatusPill } from '../ui/Badges';
import { buildTask } from '../../utils/factories';
import {
  isoFromDateAndTime,
  splitDeadline,
  formatDateKey,
} from '../../utils/date';
import { childrenOf, descendantsOf, wouldCreateDependencyCycle } from '../../utils/tasks';
import { estimateTaskDuration } from '../../services/ai';
import { describeAiError, isAiConfigured } from '../../services/ai/client';

interface TaskModalProps {
  open: boolean;
  taskId?: string | null;
  projectId?: string | null;
  parentTaskId?: string | null;
  initialDeadlineDate?: string | null;
  onClose: () => void;
  onRequestProject: () => void;
  onBreakDown: (taskId: string) => void;
  onUnstuck: (taskId: string) => void;
  onStartFocus: (taskId: string) => void;
}

interface FormState {
  title: string;
  description: string;
  projectId: string;
  parentTaskId: string;
  estimatedMinutes: string;
  difficulty: Difficulty;
  priority: Priority;
  deadlineDate: string;
  deadlineTime: string;
  scheduledDate: string;
  dependencies: string[];
  blocked: boolean;
  blockedReason: string;
}

const emptyForm: FormState = {
  title: '',
  description: '',
  projectId: '',
  parentTaskId: '',
  estimatedMinutes: '25',
  difficulty: 'medium',
  priority: 'medium',
  deadlineDate: '',
  deadlineTime: '',
  scheduledDate: '',
  dependencies: [],
  blocked: false,
  blockedReason: '',
};

export function TaskModal({
  open,
  taskId,
  projectId,
  parentTaskId,
  initialDeadlineDate,
  onClose,
  onRequestProject,
  onBreakDown,
  onUnstuck,
  onStartFocus,
}: TaskModalProps) {
  const { state, dispatch, captureSnapshot, offerUndo } = useTakTic();
  const { toast } = useToast();
  const task: Task | undefined = taskId
    ? state.tasks.find((candidate) => candidate.id === taskId)
    : undefined;
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [estimateNote, setEstimateNote] = useState<string | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [showDependencies, setShowDependencies] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setDeleteOpen(false);
    setEstimateNote(null);
    setEstimateError(null);
    setShowDependencies(false);
    setShowAdvanced(Boolean(task));
    if (task) {
      const deadline = splitDeadline(task.deadline, task.deadlineHasTime);
      setForm({
        title: task.title,
        description: task.description,
        projectId: task.projectId ?? '',
        parentTaskId: task.parentTaskId ?? '',
        estimatedMinutes: String(task.estimatedMinutes),
        difficulty: task.difficulty,
        priority: task.priority,
        deadlineDate: deadline.dateKey,
        deadlineTime: deadline.time,
        scheduledDate: task.scheduledDate ?? '',
        dependencies: [...task.dependencies],
        blocked: task.status === 'blocked',
        blockedReason: task.blockedReason ?? '',
      });
    } else {
      setForm({
        ...emptyForm,
        projectId: projectId ?? '',
        parentTaskId: parentTaskId ?? '',
        deadlineDate: initialDeadlineDate ?? '',
        scheduledDate: '',
      });
    }
    // Resetting only when the dialog target changes keeps typing stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taskId, projectId, parentTaskId, initialDeadlineDate]);

  const sortedProjects = useMemo(
    () =>
      [...state.projects].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
        return a.title.localeCompare(b.title);
      }),
    [state.projects],
  );

  const project = state.projects.find((candidate) => candidate.id === form.projectId);
  const targetProjectId = form.projectId || null;

  const parentOptions = useMemo(() => {
    const excluded = new Set<string>();
    if (task) {
      excluded.add(task.id);
      descendantsOf(state.tasks, task.id).forEach((child) => excluded.add(child.id));
    }
    return state.tasks
      .filter(
        (candidate) =>
          candidate.projectId === targetProjectId && !excluded.has(candidate.id),
      )
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [state.tasks, targetProjectId, task]);

  const dependencyOptions = useMemo(() => {
    const excluded = new Set<string>();
    if (task) {
      excluded.add(task.id);
      descendantsOf(state.tasks, task.id).forEach((child) => excluded.add(child.id));
    }
    return state.tasks
      .filter(
        (candidate) =>
          candidate.projectId === targetProjectId &&
          !excluded.has(candidate.id) &&
          candidate.status !== 'completed',
      )
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [state.tasks, targetProjectId, task]);

  const childCount = task ? childrenOf(state.tasks, task.id).length : 0;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  };

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};
    if (form.title.trim().length < 2) nextErrors.title = 'Give the task a name of at least two characters.';
    const estimate = Number(form.estimatedMinutes);
    if (!Number.isFinite(estimate) || estimate < 5) nextErrors.estimatedMinutes = 'Use at least 5 minutes.';
    if (estimate > 600) nextErrors.estimatedMinutes = 'Keep estimates under 10 hours; split larger work.';
    if (form.deadlineTime && !form.deadlineDate) nextErrors.deadlineDate = 'Choose a date for that time.';
    const dependencyIds = form.dependencies.filter((id) =>
      dependencyOptions.some((option) => option.id === id),
    );
    if (task && wouldCreateDependencyCycle(task.id, dependencyIds, state.tasks)) {
      nextErrors.dependencies = 'Those tasks already wait on this one. Choose a different order.';
      setShowDependencies(true);
      setShowAdvanced(true);
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    if (task) {
      const patch: Partial<Task> = {
        title: form.title.trim(),
        description: form.description.trim(),
        estimatedMinutes: Math.round(Number(form.estimatedMinutes)),
        difficulty: form.difficulty,
        priority: form.priority,
        deadline: form.deadlineDate
          ? isoFromDateAndTime(form.deadlineDate, form.deadlineTime || null)
          : null,
        deadlineHasTime: Boolean(form.deadlineTime),
        scheduledDate: form.scheduledDate || null,
        dependencies: form.dependencies.filter((id) => dependencyOptions.some((option) => option.id === id)),
        blockedReason: form.blocked ? form.blockedReason.trim() || 'Marked as blocked' : null,
      };
      dispatch({ type: 'UPDATE_TASK', id: task.id, patch });
      if (task.projectId !== targetProjectId || (task.parentTaskId ?? '') !== form.parentTaskId) {
        dispatch({
          type: 'MOVE_TASK',
          id: task.id,
          projectId: targetProjectId,
          parentTaskId: form.parentTaskId || null,
        });
      }
      dispatch({
        type: 'SET_BLOCKED',
        id: task.id,
        blocked: form.blocked,
        reason: form.blockedReason,
      });
      toast({ title: 'Task updated', tone: 'success' });
    } else {
      const newTask = buildTask({
        projectId: targetProjectId,
        parentTaskId: form.parentTaskId || null,
        title: form.title,
        description: form.description,
        estimatedMinutes: Number(form.estimatedMinutes),
        difficulty: form.difficulty,
        priority: form.priority,
        deadline: form.deadlineDate
          ? isoFromDateAndTime(form.deadlineDate, form.deadlineTime || null)
          : null,
        deadlineHasTime: Boolean(form.deadlineTime),
        scheduledDate: form.scheduledDate || null,
        dependencies: form.dependencies,
        blockedReason: form.blocked ? form.blockedReason.trim() || 'Marked as blocked' : null,
        status: form.blocked ? 'blocked' : 'todo',
        xp: state.settings.xp,
      });
      dispatch({ type: 'ADD_TASK', task: newTask });
      toast({
        title: 'Task added',
        description: project ? `${project.title} · ${newTask.estimatedMinutes} min` : undefined,
        tone: 'success',
      });
    }
    onClose();
  };

  const handleDelete = () => {
    if (!task) return;
    const snapshot = captureSnapshot();
    dispatch({ type: 'DELETE_TASK', id: task.id });
    setDeleteOpen(false);
    onClose();
    offerUndo(
      'Task deleted',
      snapshot,
      childrenOf(state.tasks, task.id).length > 0
        ? 'The task and its subtasks were removed.'
        : 'The task was removed.',
    );
  };

  const handleEstimate = async () => {
    if (!form.title.trim()) {
      setErrors((current) => ({ ...current, title: 'Add a title first.' }));
      return;
    }
    setEstimating(true);
    setEstimateError(null);
    setEstimateNote(null);
    try {
      const history = state.tasks
        .filter(
          (candidate) =>
            candidate.status === 'completed' &&
            candidate.actualMinutes > 0 &&
            candidate.childTaskIds.length === 0,
        )
        .slice(-6)
        .map((candidate) => ({
          title: candidate.title,
          estimated: candidate.estimatedMinutes,
          actual: candidate.actualMinutes,
        }));
      const result = await estimateTaskDuration({
        title: form.title,
        description: form.description,
        projectTitle: project?.title ?? 'No project',
        history,
        config: state.settings.ai,
      });
      setForm((current) => ({ ...current, estimatedMinutes: String(result.estimatedMinutes) }));
      setEstimateNote(`${result.reasoning} (${result.confidence} confidence)`);
    } catch (error) {
      setEstimateError(describeAiError(error));
    } finally {
      setEstimating(false);
    }
  };

  const aiReady = isAiConfigured(state.settings.ai);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={task ? 'Edit task' : 'New task'}
        eyebrow={task ? 'Task detail' : 'Add to the plan'}
        description={
          task
            ? 'Small, concrete steps are easier to start than large ones.'
            : 'A task is one action. A project is optional; a clear title is enough to start.'
        }
        width="lg"
        footer={
          <>
            {task ? (
              <div className="mr-auto flex flex-wrap items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => onBreakDown(task.id)}>
                  <Wand2 size={13} aria-hidden />
                  Split task
                </Button>
                {task.status !== 'completed' ? (
                  <Button variant="ghost" size="sm" onClick={() => onUnstuck(task.id)}>
                    <LifeBuoy size={13} aria-hidden />
                    Having trouble?
                  </Button>
                ) : null}
                {task.status !== 'completed' ? (
                  <Button variant="ghost" size="sm" onClick={() => onStartFocus(task.id)}>
                    Focus
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:text-danger"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 size={13} aria-hidden />
                  Delete
                </Button>
              </div>
            ) : null}
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave}>
              {task ? 'Save changes' : 'Create task'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
                      <Field
              label="Task title"
              htmlFor="task-title"
              required
              error={errors.title}
              hint="What do you need to get done? A task is one action; a project is optional."
            >
            <Input
              id="task-title"
              value={form.title}
              onChange={(event) => update('title', event.target.value)}
              placeholder="e.g. Read the assignment brief"
              data-autofocus="true"
              maxLength={180}
            />
          </Field>

          <Field
            label="Notes"
            htmlFor="task-description"
            hint="Optional. What exactly does “done” look like?"
          >
            <Textarea
              id="task-description"
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              rows={3}
              placeholder="A short description, a reference, or the first line you need."
              maxLength={2000}
            />
          </Field>

          <div className="grid gap-4">
            <Field
              label="Project"
              htmlFor="task-project"
              hint="Add to a project (optional). Leave it as Personal for a standalone task."
            >
              <Select
                id="task-project"
                value={form.projectId}
                onChange={(event) => {
                  update('projectId', event.target.value);
                  update('parentTaskId', '');
                  update('dependencies', []);
                }}
              >
                <option value="">Personal — no project</option>
                {sortedProjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                    {item.status === 'completed' ? ' (completed)' : ''}
                  </option>
                ))}
              </Select>
              {sortedProjects.length === 0 ? (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted">
                  <span>You can save this task without creating a project.</span>
                  <button
                    type="button"
                    className="text-accent underline decoration-accent/40 underline-offset-2"
                    onClick={onRequestProject}
                  >
                    Create a project instead
                  </button>
                </div>
              ) : null}
            </Field>
          </div>

                        <Field
                label="Due date"
                htmlFor="task-deadline"
                hint="Optional. You can change it later directly on the task."
                error={errors.deadlineDate}
              >
            <Input
              id="task-deadline"
              type="date"
              value={form.deadlineDate}
              onChange={(event) => update('deadlineDate', event.target.value)}
              aria-invalid={Boolean(errors.deadlineDate)}
            />
          </Field>

          <div className="border-t border-line pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced((current) => !current)}
              className="flex w-full items-center justify-between gap-3 py-2 text-left"
              aria-expanded={showAdvanced}
            >
              <span>
                <span className="block text-[14px] font-medium text-ink">More options</span>
                <span className="mt-0.5 block text-[13px] text-muted">
                  Priority, estimate, subtasks and tasks to finish first.
                </span>
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent">
                {showAdvanced ? 'Hide' : 'Show'}
              </span>
            </button>
          </div>

          {showAdvanced ? (
          <div className="space-y-4 border-t border-line pt-4">
            <Field
              label="Parent task"
              htmlFor="task-parent"
              hint="Leave empty for a top-level task. Personal tasks can have subtasks too."
            >
              <Select
                id="task-parent"
                value={form.parentTaskId}
                onChange={(event) => update('parentTaskId', event.target.value)}
                disabled={parentOptions.length === 0}
              >
                <option value="">None</option>
                {parentOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </Select>
            </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Estimated time"
              htmlFor="task-estimate"
              error={errors.estimatedMinutes}
              hint={`Reward: ${state.settings.xp[form.difficulty]} XP when completed`}
            >
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="task-estimate"
                    type="number"
                    min={5}
                    max={600}
                    step={5}
                    value={form.estimatedMinutes}
                    onChange={(event) => update('estimatedMinutes', event.target.value)}
                    className="pr-12"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[12px] text-muted">
                    min
                  </span>
                </div>
                {aiReady ? (
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => void handleEstimate()}
                    disabled={estimating}
                    title="Estimate with AI"
                  >
                    {estimating ? <Spinner /> : <Sparkles size={13} aria-hidden />}
                    AI
                  </Button>
                ) : null}
              </div>
            </Field>

            <Field label="Difficulty" htmlFor="task-difficulty">
              <Segmented
                value={form.difficulty}
                onChange={(value) => update('difficulty', value)}
                items={[
                  { value: 'easy', label: 'Easy' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'hard', label: 'Hard' },
                ]}
                className="w-full [&>button]:flex-1"
              />
            </Field>
          </div>

          {!aiReady ? (
            <InlineNote>
              AI estimates and breakdowns need an OpenRouter key.{' '}
              <Link to="/settings#ai" className="text-accent underline decoration-accent/40 underline-offset-2">
                Add it in Settings
              </Link>
              . Everything else works without it.
            </InlineNote>
          ) : null}
          {estimateNote ? <InlineNote tone="sage">{estimateNote}</InlineNote> : null}
          {estimateError ? (
            <InlineNote tone="accent">{estimateError}</InlineNote>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Priority" htmlFor="task-priority">
              <Select
                id="task-priority"
                value={form.priority}
                onChange={(event) => update('priority', event.target.value as Priority)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </Field>
            <Field
              label="Time"
              htmlFor="task-deadline-time"
              error={errors.deadlineDate}
            >
              <Input
                id="task-deadline-time"
                type="time"
                value={form.deadlineTime}
                onChange={(event) => update('deadlineTime', event.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Work on this day"
            htmlFor="task-scheduled"
            hint="Scheduled tasks appear in Today and on the calendar."
          >
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="task-scheduled"
                type="date"
                value={form.scheduledDate}
                onChange={(event) => update('scheduledDate', event.target.value)}
                className="max-w-[190px]"
              />
              <Button
                variant="quiet"
                size="sm"
                type="button"
                onClick={() => {
                  const date = new Date();
                  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                  update('scheduledDate', key);
                }}
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => update('scheduledDate', '')}
                disabled={!form.scheduledDate}
              >
                Clear
              </Button>
              {form.scheduledDate ? (
                <span className="font-mono text-[12px] text-muted">
                  {formatDateKey(form.scheduledDate, { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
              ) : null}
            </div>
          </Field>

          <div className="border border-line">
            <button
              type="button"
              onClick={() => setShowDependencies((current) => !current)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left"
              aria-expanded={showDependencies}
            >
              <span className="text-[14px] text-ink">
                Tasks to complete first
                {form.dependencies.length > 0 ? (
                  <span className="ml-1.5 font-mono text-[12px] text-accent">
                    {form.dependencies.length}
                  </span>
                ) : null}
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                {showDependencies ? 'Hide' : 'Add'}
              </span>
            </button>
            {showDependencies ? (
              <div className="max-h-40 overflow-y-auto border-t border-line px-3 py-2">
                {dependencyOptions.length === 0 ? (
                  <p className="py-2 text-[13px] text-muted">
                    No other open tasks in this project.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {dependencyOptions.map((option) => {
                      const checked = form.dependencies.includes(option.id);
                      return (
                        <li key={option.id}>
                          <label className="flex cursor-pointer items-center gap-2 py-1 text-[14px] text-ink/85">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                update(
                                  'dependencies',
                                  checked
                                    ? form.dependencies.filter((id) => id !== option.id)
                                    : [...form.dependencies, option.id],
                                )
                              }
                              className="h-3.5 w-3.5 accent-[rgb(var(--accent))]"
                            />
                            <span className="flex-1 truncate">{option.title}</span>
                            <span className="font-mono text-[11px] text-muted">
                              {option.estimatedMinutes} min
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : null}
            {errors.dependencies ? (
              <p className="border-t border-line px-3 py-2 text-[13px] text-accent" role="alert">
                {errors.dependencies}
              </p>
            ) : null}
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 border border-line px-3 py-2.5">
            <input
              type="checkbox"
              checked={form.blocked}
              onChange={(event) => update('blocked', event.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-[rgb(var(--accent))]"
            />
            <span className="flex-1">
              <span className="block text-[14px] text-ink">Mark this task as blocked</span>
              <span className="mt-0.5 block text-[13px] leading-5 text-muted">
                TakTic will show the reason, but never prevent you from working on it.
              </span>
              {form.blocked ? (
                <Input
                  value={form.blockedReason}
                  onChange={(event) => update('blockedReason', event.target.value)}
                  placeholder="e.g. Waiting for feedback from my tutor"
                  className="mt-2"
                  maxLength={200}
                />
              ) : null}
            </span>
          </label>
          </div>
          ) : null}

          {task ? (
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3 text-[12px] text-muted">
              <StatusPill tone={task.status === 'completed' ? 'sage' : task.status === 'blocked' ? 'accent' : 'neutral'}>
                {task.status === 'in_progress' ? 'in progress' : task.status}
              </StatusPill>
              <PriorityBadge priority={task.priority} />
              {childCount > 0 ? (
                <span className="font-mono text-[12px]">{childCount} subtasks</span>
              ) : null}
              <span className="ml-auto font-mono text-[11px]">
                created {new Date(task.createdAt).toLocaleDateString('en-GB')}
              </span>
            </div>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete this task?"
        description={
          task && childCount > 0
            ? 'This also removes every subtask underneath it. Completed history stays in your XP ledger, but the tasks themselves will be deleted.'
            : 'The task will be removed. You can undo this straight afterwards.'
        }
        confirmLabel="Delete task"
        tone="danger"
      />
    </>
  );
}
