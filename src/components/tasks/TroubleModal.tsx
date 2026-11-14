import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, ChevronRight, LifeBuoy, Lock, Sparkles, Wand2 } from 'lucide-react';
import type { AdaptationRecord, FeedbackType, Task, TaskDraft } from '../../types';
import { FEEDBACK_OPTIONS } from '../../data/feedback';
import { useTakTic } from '../../store/TakTicProvider';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Form';
import { InlineNote, Skeleton } from '../ui/Feedback';
import { cn } from '../../utils/cn';
import { uid } from '../../utils/id';
import { describeAiError, isAiConfigured } from '../../services/ai/client';
import { adaptTask } from '../../services/ai';
import { templateAdaptation } from '../../services/ai/templates';
import {
  childrenOf,
  incompleteDependencies,
  openLeaves,
  orderTasksByDependencies,
} from '../../utils/tasks';

interface TroubleModalProps {
  open: boolean;
  task: Task | null;
  onClose: () => void;
}

interface AdaptationPreview {
  reasoning: string;
  subtasks: TaskDraft[];
  revisedEstimateMinutes?: number;
  suggestedFocusMinutes?: number;
  reframedTask?: { title: string; description: string };
  source: 'ai' | 'template';
  strategy?: string;
}

export function TroubleModal({ open, task, onClose }: TroubleModalProps) {
  const { state, dispatch, captureSnapshot, offerUndo } = useTakTic();
  const [pickedTaskId, setPickedTaskId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackType | null>(null);
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<AdaptationPreview | null>(null);
  const [selected, setSelected] = useState<boolean[]>([]);
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPickedTaskId(task?.id ?? null);
    setFeedback(null);
    setExplanation('');
    setLoading(false);
    setError(null);
    setPreview(null);
    setSelected([]);
    setApplyError(null);
  }, [open, task?.id]);

  const effectiveTask = task ?? state.tasks.find((candidate) => candidate.id === pickedTaskId) ?? null;
  const openTasks = useMemo(() => {
    const ordered = orderTasksByDependencies(openLeaves(state.tasks), state.tasks);
    const readyIds = new Set(
      ordered
        .filter((candidate) => incompleteDependencies(candidate, state.tasks).length === 0 && candidate.status !== 'blocked')
        .map((candidate) => candidate.id),
    );
    return [...ordered].sort((a, b) => Number(!readyIds.has(a.id)) - Number(!readyIds.has(b.id)));
  }, [state.tasks]);

  const pickTask = (taskId: string) => {
    setPickedTaskId(taskId);
    setFeedback(null);
    setExplanation('');
    setError(null);
    setPreview(null);
    setSelected([]);
    setApplyError(null);
  };

  const completedSubtasks = useMemo(
    () =>
      effectiveTask
        ? childrenOf(state.tasks, effectiveTask.id).filter((child) => child.status === 'completed')
        : [],
    [state.tasks, effectiveTask],
  );
  const projectTitle =
    state.projects.find((project) => project.id === effectiveTask?.projectId)?.title ?? '';

  const aiReady = isAiConfigured(state.settings.ai);

  const generateWithAi = async () => {
    if (!effectiveTask || !feedback) return;
    setLoading(true);
    setError(null);
    try {
      const sessions = state.focusSessions
        .filter((session) => session.taskId === effectiveTask.id)
        .slice(-4)
        .map((session) => ({
          plannedSeconds: session.plannedSeconds,
          actualSeconds: session.actualSeconds,
        }));
      const result = await adaptTask({
        task: effectiveTask,
        projectTitle,
        feedback,
        explanation,
        completedSubtasks: completedSubtasks.map((child) => child.title),
        recentSessions: sessions,
        config: state.settings.ai,
      });
      setPreview({
        reasoning: result.reasoning,
        subtasks: result.subtasks,
        revisedEstimateMinutes: result.revisedEstimateMinutes,
        suggestedFocusMinutes: result.suggestedFocusMinutes,
        reframedTask: result.reframedTask,
        source: 'ai',
        strategy: result.strategy,
      });
      setSelected(result.subtasks.map(() => true));
    } catch (caught) {
      setError(describeAiError(caught));
    } finally {
      setLoading(false);
    }
  };

  const generateTemplate = () => {
    if (!effectiveTask || !feedback) return;
    const result = templateAdaptation(effectiveTask, feedback);
    setPreview({
      ...result,
      source: 'template',
      reasoning: `${result.reasoning} This is a fixed structural template, not an AI response.`,
    });
    setSelected(result.subtasks.map(() => true));
    setError(null);
  };

  const apply = () => {
    if (!effectiveTask || !preview) return;
    const chosen = preview.subtasks.filter((_, index) => selected[index]);
    if (chosen.length === 0) {
      setApplyError('Select at least one step to add.');
      return;
    }
    const snapshot = captureSnapshot();
    const record: AdaptationRecord = {
      id: uid('adapt'),
      taskId: effectiveTask.id,
      feedbackType: feedback ?? 'other',
      userExplanation: explanation.trim(),
      generatedTasks: chosen.map((draft) => draft.title),
      reasoning: preview.reasoning,
      previousEstimateMinutes: preview.revisedEstimateMinutes
        ? effectiveTask.estimatedMinutes
        : undefined,
      createdAt: new Date().toISOString(),
    };
    dispatch({
      type: 'APPLY_ADAPTATION',
      taskId: effectiveTask.id,
      record,
      subtasks: chosen,
      revisedEstimateMinutes: preview.revisedEstimateMinutes,
      reframedTask: preview.reframedTask,
    });
    onClose();
    offerUndo(
      'Task broken into smaller steps',
      snapshot,
      `${chosen.length} step${chosen.length === 1 ? '' : 's'} added. Completed work and the original task were preserved.`,
    );
  };

  const totalMinutes = preview
    ? preview.subtasks.reduce(
        (sum, draft, index) => (selected[index] ? sum + draft.estimatedMinutes : sum),
        0,
      )
    : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        preview
          ? 'Review the new shape'
          : effectiveTask
            ? 'What is in the way?'
            : 'Help me get unstuck'
      }
      eyebrow={effectiveTask ? 'Adaptive task decomposition' : 'Unstuck'}
      description={
        preview
          ? 'Nothing changes until you apply it. Uncheck anything that does not help.'
          : effectiveTask
            ? `“${effectiveTask.title}” — tell TakTic what is actually making this hard.`
            : 'Choose the step that feels stuck. You can adapt it without losing completed work.'
      }
      width="lg"
      footer={
        preview ? (
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setPreview(null);
                setError(null);
              }}
              className="mr-auto"
            >
              <ArrowLeft size={13} aria-hidden />
              Change feedback
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={apply}>
              Add {selected.filter(Boolean).length} step
              {selected.filter(Boolean).length === 1 ? '' : 's'}
            </Button>
          </>
        ) : !effectiveTask ? (
          <Button variant="ghost" onClick={onClose} className="mr-auto">
            Not now
          </Button>
        ) : loading ? null : (
          <>
            <Button
              variant="ghost"
              onClick={() => {
                if (!task) {
                  setPickedTaskId(null);
                  setFeedback(null);
                  setPreview(null);
                } else {
                  onClose();
                }
              }}
              className="mr-auto"
            >
              <ArrowLeft size={13} aria-hidden />
              {task ? 'Not now' : 'Choose another task'}
            </Button>
            <Button
              variant="secondary"
              onClick={generateTemplate}
              disabled={!feedback}
              title="Use a fixed structure template instead of AI"
            >
              Use a template
            </Button>
            <Button
              variant="primary"
              onClick={() => void generateWithAi()}
              disabled={!feedback || !aiReady}
            >
              <Sparkles size={13} aria-hidden />
              Rework with AI
            </Button>
          </>
        )
      }
    >
      {!effectiveTask ? (
        <div className="space-y-4">
          <div className="border-l-2 border-accent/50 pl-3">
            <p className="eyebrow mb-1">One step at a time</p>
            <p className="text-[14px] leading-6 text-ink/85">
              Pick the task that feels hardest to start. TakTic can shrink it, explain it, or
              change the approach — but only after you review the proposal.
            </p>
          </div>
          {openTasks.length === 0 ? (
            <InlineNote>
              There is no open task to adapt yet. Add one first, or split a large task into a first
              step.
            </InlineNote>
          ) : (
            <ul className="max-h-[320px] divide-y divide-line overflow-y-auto border border-line">
              {openTasks.map((candidate) => {
                const waiting = incompleteDependencies(candidate, state.tasks);
                const project = state.projects.find((item) => item.id === candidate.projectId);
                return (
                  <li key={candidate.id}>
                    <button
                      type="button"
                      onClick={() => pickTask(candidate.id)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface2/45"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-line text-muted">
                        {waiting.length > 0 || candidate.status === 'blocked' ? (
                          <Lock size={12} aria-hidden />
                        ) : (
                          <LifeBuoy size={12} aria-hidden />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] text-ink">
                          {candidate.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-muted">
                          {project?.title ?? 'No project'} · {candidate.estimatedMinutes} min
                          {waiting.length > 0
                            ? ` · waiting on ${waiting.map((item) => item.title).join(', ')}`
                            : candidate.status === 'blocked'
                              ? ' · marked blocked'
                              : ' · ready now'}
                        </span>
                      </span>
                      <ChevronRight size={14} className="shrink-0 text-muted" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : loading ? (
        <div className="space-y-5 py-2">
          <div className="flex items-center gap-2 text-[14px] text-muted">
            <span className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-accent" aria-hidden />
            Reworking the task around the difficulty you described…
          </div>
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <div className="space-y-2 pt-2">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        </div>
      ) : preview ? (
        <div className="space-y-5">
          {preview.source === 'template' ? (
            <InlineNote tone="accent">
              This structure came from a fixed template, not from AI. Edit anything once it is
              applied.
            </InlineNote>
          ) : null}
          <div className="border-l-2 border-accent/50 pl-3">
            <p className="eyebrow mb-1">Why this shape</p>
            <p className="text-[14px] leading-6 text-ink/85">{preview.reasoning}</p>
          </div>

          {completedSubtasks.length > 0 ? (
            <InlineNote tone="sage">
              {completedSubtasks.length} completed subtask
              {completedSubtasks.length === 1 ? '' : 's'} will be preserved exactly as they are.
            </InlineNote>
          ) : null}

          {preview.reframedTask && preview.reframedTask.title !== effectiveTask.title ? (
            <div className="border border-line bg-surface2/40 px-3 py-2.5">
              <p className="eyebrow mb-1">Proposed reframe</p>
              <p className="text-[15px] font-medium text-ink">{preview.reframedTask.title}</p>
              {preview.reframedTask.description ? (
                <p className="mt-1 text-[13px] leading-5 text-muted">
                  {preview.reframedTask.description}
                </p>
              ) : null}
            </div>
          ) : null}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="eyebrow">Proposed steps</p>
              <span className="font-mono text-[11px] text-muted">
                {selected.filter(Boolean).length} selected · {totalMinutes} min
              </span>
            </div>
            <ul className="divide-y divide-line border border-line">
              {preview.subtasks.map((draft, index) => {
                const isSelected = selected[index];
                return (
                  <li key={`${draft.title}-${index}`}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors',
                        isSelected ? 'bg-paper' : 'bg-surface2/40 text-muted',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() =>
                          setSelected((current) =>
                            current.map((value, itemIndex) =>
                              itemIndex === index ? !value : value,
                            ),
                          )
                        }
                        className="mt-0.5 h-3.5 w-3.5 accent-[rgb(var(--accent))]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] leading-5">{draft.title}</span>
                        {draft.description ? (
                          <span className="mt-0.5 block text-[13px] leading-5 text-muted">
                            {draft.description}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 pt-0.5 font-mono text-[11px] text-muted">
                        {draft.estimatedMinutes} min
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-3 text-[13px] text-muted">
            {preview.revisedEstimateMinutes ? (
              <span>
                Estimate:{' '}
                <span className="font-mono text-muted line-through decoration-muted/50">
                  {effectiveTask.estimatedMinutes} min
                </span>{' '}
                →{' '}
                <span className="font-mono text-ink">{preview.revisedEstimateMinutes} min</span>
              </span>
            ) : null}
            {preview.suggestedFocusMinutes ? (
              <span>
                Suggested focus:{' '}
                <span className="font-mono text-ink">{preview.suggestedFocusMinutes} min</span>
              </span>
            ) : null}
            {preview.strategy ? (
              <span className="font-mono text-[11px] uppercase tracking-[0.08em]">
                {preview.strategy.replace('_', ' ')}
              </span>
            ) : null}
          </div>
          {applyError ? <p className="text-[14px] text-accent">{applyError}</p> : null}
        </div>
      ) : (
        <div className="space-y-5">
          {!aiReady ? (
            <div className="border border-line bg-surface2/40 px-4 py-3">
              <p className="text-[14px] font-medium text-ink">AI adaptation is not configured</p>
              <p className="mt-1 text-[13px] leading-5 text-muted">
                Add an OpenRouter API key in Settings to let the companion restructure this task.
                You can still use a fixed structural template, clearly labelled as such.{' '}
                <Link
                  to="/settings#ai"
                  className="text-accent underline decoration-accent/40 underline-offset-2"
                >
                  Open AI settings
                </Link>
              </p>
            </div>
          ) : null}

          <fieldset>
            <legend className="eyebrow mb-2.5">What is making this difficult?</legend>
            <div className="grid gap-px border border-line bg-line sm:grid-cols-2">
              {FEEDBACK_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = feedback === option.id;
                return (
                  <label
                    key={option.id}
                    className={cn(
                      'flex cursor-pointer items-start gap-2.5 bg-paper px-3 py-3 transition-colors',
                      active ? 'bg-accent-soft/70' : 'hover:bg-surface2/50',
                    )}
                  >
                    <input
                      type="radio"
                      name="trouble-feedback"
                      value={option.id}
                      checked={active}
                      onChange={() => setFeedback(option.id)}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border',
                        active
                          ? 'border-accent bg-accent text-paper'
                          : 'border-line text-muted',
                      )}
                    >
                      <Icon size={13} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] leading-5 text-ink">{option.label}</span>
                      <span className="mt-0.5 block text-[12px] leading-4 text-muted">
                        {option.description}
                      </span>
                    </span>
                    {active ? (
                      <Check size={13} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                    ) : null}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label
              htmlFor="trouble-explanation"
              className="mb-1.5 block text-[13px] font-medium text-ink/80"
            >
              Anything else? <span className="font-normal text-muted">(optional)</span>
            </label>
            <Textarea
              id="trouble-explanation"
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              rows={3}
              maxLength={800}
              placeholder={
                feedback === 'resources'
                  ? 'e.g. I cannot access the textbook chapter the task refers to.'
                  : feedback === 'time'
                    ? 'e.g. I thought it would take 20 minutes but I am still going after an hour.'
                    : 'e.g. Every time I open the document I freeze.'
              }
            />
            {feedback === 'time' ? (
              <p className="mt-1.5 text-[13px] leading-5 text-muted">
                If you do not say whether the estimate was too short or too long, TakTic will make
                a cautious revision and explain the assumption.
              </p>
            ) : null}
          </div>

          {error ? (
            <div className="border-l-2 border-accent pl-3">
              <p className="text-[14px] leading-5 text-ink">{error}</p>
              <button
                type="button"
                onClick={() => void generateWithAi()}
                className="mt-1 text-[13px] text-accent underline decoration-accent/40 underline-offset-2"
              >
                Try again
              </button>
            </div>
          ) : null}

          <p className="border-t border-line pt-3 text-[12px] leading-5 text-muted">
            <Wand2 size={11} className="mr-1 inline" aria-hidden />
            Your completed work and the original task are preserved. Nothing is applied until you
            review the proposal.
          </p>
        </div>
      )}
    </Modal>
  );
}
