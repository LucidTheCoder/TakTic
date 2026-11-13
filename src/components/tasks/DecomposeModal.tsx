import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Sparkles, Wand2 } from 'lucide-react';
import type { Task, TaskDraft } from '../../types';
import { useTakTic } from '../../store/TakTicProvider';
import { useToast } from '../ui/ToastProvider';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Input, Textarea } from '../ui/Form';
import { InlineNote, Skeleton } from '../ui/Feedback';
import { cn } from '../../utils/cn';
import { uid } from '../../utils/id';
import { buildProject, buildTask } from '../../utils/factories';
import { describeAiError, isAiConfigured } from '../../services/ai/client';
import { adaptTask, decomposeTask } from '../../services/ai';
import { templateAdaptation, templateDecomposition } from '../../services/ai/templates';
import { childrenOf } from '../../utils/tasks';

interface DecomposeModalProps {
  open: boolean;
  taskId?: string | null;
  projectId?: string | null;
  seedTitle?: string;
  onClose: () => void;
  onCreated?: (projectId: string) => void;
}

type PhasePreview = { title: string; tasks: TaskDraft[] };

type Preview =
  | {
      kind: 'project';
      projectTitle: string;
      projectDescription: string;
      phases: PhasePreview[];
      reasoning: string;
      source: 'ai' | 'template';
    }
  | {
      kind: 'task';
      subtasks: TaskDraft[];
      reasoning: string;
      revisedEstimateMinutes?: number;
      source: 'ai' | 'template';
    };

export function DecomposeModal({
  open,
  taskId,
  projectId,
  seedTitle,
  onClose,
  onCreated,
}: DecomposeModalProps) {
  const { state, dispatch, captureSnapshot, offerUndo } = useTakTic();
  const { toast } = useToast();
  const navigate = useNavigate();
  const task: Task | undefined = taskId
    ? state.tasks.find((candidate) => candidate.id === taskId)
    : undefined;
  const targetProject = projectId
    ? state.projects.find((project) => project.id === projectId)
    : undefined;

  const [goal, setGoal] = useState('');
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [projectTitle, setProjectTitle] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<boolean[]>([]);
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setGoal(task?.title ?? seedTitle ?? '');
    setContext('');
    setLoading(false);
    setError(null);
    setPreview(null);
    setApplyError(null);
    setProjectTitle('');
  }, [open, taskId, projectId, seedTitle, task?.title]);

  const aiReady = isAiConfigured(state.settings.ai);
  const projectPriority = targetProject?.priority ?? 'medium';
  const completedChildren = task
    ? childrenOf(state.tasks, task.id).filter((child) => child.status === 'completed')
    : [];

  const previewTaskCount = useMemo(() => {
    if (!preview) return 0;
    if (preview.kind === 'task') return preview.subtasks.length;
    return preview.phases.reduce((sum, phase) => sum + phase.tasks.length, 0);
  }, [preview]);

  const selectedProjectTasks = useMemo(() => {
    if (!preview || preview.kind !== 'project') return 0;
    let index = 0;
    let count = 0;
    for (const phase of preview.phases) {
      for (let taskIndex = 0; taskIndex < phase.tasks.length; taskIndex += 1) {
        if (selectedTasks[index]) count += 1;
        index += 1;
      }
    }
    return count;
  }, [preview, selectedTasks]);

  const selectedTaskPreviewCount = preview?.kind === 'task'
    ? selectedTasks.filter(Boolean).length
    : 0;

  const resetToInput = () => {
    setPreview(null);
    setError(null);
    setApplyError(null);
  };

  const generateWithAi = async () => {
    if (!aiReady) {
      setError('Add an OpenRouter API key in Settings to use AI decomposition.');
      return;
    }
    if (task) {
      setLoading(true);
      setError(null);
      try {
        const result = await adaptTask({
          task,
          projectTitle: targetProject?.title ?? state.projects.find((project) => project.id === task.projectId)?.title ?? '',
          feedback: 'too_big',
          explanation: 'Regenerate a clearer, more startable breakdown for this specific task.',
          completedSubtasks: completedChildren.map((child) => child.title),
          recentSessions: state.focusSessions
            .filter((session) => session.taskId === task.id)
            .slice(-4)
            .map((session) => ({
              plannedSeconds: session.plannedSeconds,
              actualSeconds: session.actualSeconds,
            })),
          config: state.settings.ai,
        });
        setPreview({
          kind: 'task',
          subtasks: result.subtasks,
          reasoning: result.reasoning,
          revisedEstimateMinutes: result.revisedEstimateMinutes,
          source: 'ai',
        });
        setSelectedTasks(result.subtasks.map(() => true));
      } catch (caught) {
        setError(describeAiError(caught));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (goal.trim().length < 4) {
      setError('Describe the large task first — a sentence is enough.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await decomposeTask({
        goal: goal.trim(),
        description: context.trim(),
        deadline: null,
        availableMinutesPerDay: state.settings.planner.availableMinutes,
        config: state.settings.ai,
      });
      setPreview({
        kind: 'project',
        projectTitle: result.projectTitle,
        projectDescription: result.projectDescription,
        phases: result.phases,
        reasoning: result.reasoning,
        source: 'ai',
      });
      setProjectTitle(result.projectTitle);
      setSelectedTasks(result.phases.flatMap((phase) => phase.tasks.map(() => true)));
    } catch (caught) {
      setError(describeAiError(caught));
    } finally {
      setLoading(false);
    }
  };

  const generateTemplate = () => {
    if (task) {
      const result = templateAdaptation(task, 'too_big');
      setPreview({
        kind: 'task',
        subtasks: result.subtasks,
        reasoning: `${result.reasoning} This is a fixed template, not an AI response.`,
        revisedEstimateMinutes: result.revisedEstimateMinutes,
        source: 'template',
      });
      setSelectedTasks(result.subtasks.map(() => true));
      setError(null);
      return;
    }
    if (goal.trim().length < 4) {
      setError('Describe the large task first — a sentence is enough.');
      return;
    }
    const result = templateDecomposition(goal.trim());
    setPreview({
      kind: 'project',
      projectTitle: result.projectTitle,
      projectDescription: result.projectDescription,
      phases: result.phases,
      reasoning:
        'A fixed four-part structure from a template, not an AI response. Edit the steps after creating it so they match your actual assignment.',
      source: 'template',
    });
    setProjectTitle(result.projectTitle);
    setSelectedTasks(result.phases.flatMap((phase) => phase.tasks.map(() => true)));
    setError(null);
  };

  const applyTaskAdaptation = () => {
    if (!task || !preview || preview.kind !== 'task') return;
    const chosen = preview.subtasks.filter((_, index) => selectedTasks[index]);
    if (chosen.length === 0) {
      setApplyError('Select at least one step.');
      return;
    }
    const snapshot = captureSnapshot();
    dispatch({
      type: 'APPLY_ADAPTATION',
      taskId: task.id,
      record: {
        id: uid('adapt'),
        taskId: task.id,
        feedbackType: 'too_big',
        userExplanation: 'Regenerated a clearer breakdown for this task.',
        generatedTasks: chosen.map((draft) => draft.title),
        reasoning: preview.reasoning,
        createdAt: new Date().toISOString(),
      },
      subtasks: chosen,
      revisedEstimateMinutes: preview.revisedEstimateMinutes,
    });
    onClose();
    offerUndo(
      'Task broken down',
      snapshot,
      `${chosen.length} new step${chosen.length === 1 ? '' : 's'} added beneath the original task.`,
    );
  };

  const applyProjectDecomposition = () => {
    if (!preview || preview.kind !== 'project') return;
    if (!targetProject && projectTitle.trim().length < 2) {
      setApplyError('Give the new project a name.');
      return;
    }
    let cursor = 0;
    const phases: Array<{ title: string; tasks: TaskDraft[] }> = [];
    for (const phase of preview.phases) {
      const tasks: TaskDraft[] = [];
      for (const draft of phase.tasks) {
        if (selectedTasks[cursor]) tasks.push(draft);
        cursor += 1;
      }
      if (tasks.length > 0) phases.push({ title: phase.title, tasks });
    }
    if (phases.length === 0) {
      setApplyError('Select at least one step to create.');
      return;
    }

    const snapshot = captureSnapshot();
    const timestamp = new Date().toISOString();
    const project = targetProject
      ? targetProject
      : buildProject({
          title: projectTitle,
          description: preview.projectDescription,
          priority: projectPriority,
        });

    if (!targetProject) {
      dispatch({ type: 'ADD_PROJECT', project });
    }

    const tasks: Task[] = [];
    phases.forEach((phase, phaseIndex) => {
      const phaseTask = buildTask({
        projectId: project.id,
        title: phase.title,
        description: 'A phase created during task decomposition.',
        estimatedMinutes: phase.tasks.reduce((sum, draft) => sum + draft.estimatedMinutes, 0),
        difficulty: 'medium',
        priority: project.priority,
        order: phaseIndex * 100,
        createdAt: timestamp,
        xp: state.settings.xp,
      });
      tasks.push(phaseTask);
      phase.tasks.forEach((draft, taskIndex) => {
        tasks.push(
          buildTask({
            projectId: project.id,
            parentTaskId: phaseTask.id,
            title: draft.title,
            description: draft.description,
            estimatedMinutes: draft.estimatedMinutes,
            difficulty: draft.difficulty,
            priority: draft.priority ?? project.priority,
            order: phaseIndex * 100 + (taskIndex + 1) * 10,
            createdAt: timestamp,
            xp: state.settings.xp,
          }),
        );
      });
    });

    dispatch({ type: 'ADD_TASKS', tasks, projectId: project.id });
    onClose();
    offerUndo(
      targetProject ? 'Steps added to project' : 'Project created from a large task',
      snapshot,
      `${tasks.filter((candidate) => candidate.parentTaskId).length} actionable steps across ${phases.length} phases.`,
    );
    toast({
      title: targetProject ? 'Breakdown added' : 'Project created',
      description: `“${project.title}” now has a working structure.`,
      tone: 'success',
    });
    if (!targetProject) {
      onCreated?.(project.id);
      navigate(`/projects/${project.id}`);
    }
  };

  const apply = () => {
    setApplyError(null);
    if (preview?.kind === 'task') applyTaskAdaptation();
    else applyProjectDecomposition();
  };

  const selectedCount = preview?.kind === 'task' ? selectedTaskPreviewCount : selectedProjectTasks;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        preview
          ? preview.kind === 'task'
            ? 'Review the breakdown'
            : targetProject
              ? `Add steps to ${targetProject.title}`
              : 'Your new project'
          : task
            ? 'Break this task down'
            : 'Break down a large task'
      }
      eyebrow={task ? 'Individual task breakdown' : 'AI task decomposition'}
      description={
        preview
          ? 'Nothing is created until you apply this. Uncheck steps you do not need.'
          : task
            ? 'The original task stays in place. New steps are added underneath it, preserving completed work.'
            : 'Describe the overwhelming thing. TakTic will turn it into phases and small, startable steps.'
      }
      width="lg"
      footer={
        preview ? (
          <>
            <Button variant="ghost" onClick={resetToInput} className="mr-auto">
              <ArrowLeft size={13} aria-hidden />
              Back
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={apply} disabled={selectedCount === 0}>
              {preview.kind === 'task'
                ? `Add ${selectedCount} step${selectedCount === 1 ? '' : 's'}`
                : `Create ${selectedCount} step${selectedCount === 1 ? '' : 's'}`}
            </Button>
          </>
        ) : loading ? null : (
          <>
            <Button variant="ghost" onClick={onClose} className="mr-auto">
              Cancel
            </Button>
            <Button variant="secondary" onClick={generateTemplate} title="Use a fixed template instead of AI">
              Use a template
            </Button>
            <Button variant="primary" onClick={() => void generateWithAi()} disabled={!aiReady}>
              <Sparkles size={13} aria-hidden />
              Break down with AI
            </Button>
          </>
        )
      }
    >
      {loading ? (
        <div className="space-y-5 py-2">
          <div className="flex items-center gap-2 text-[12px] text-muted">
            <span className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-accent" aria-hidden />
            Finding the shape of this work…
          </div>
          <Skeleton className="h-3 w-2/3" />
          {[0, 1, 2].map((phase) => (
            <div key={phase} className="border border-line p-3">
              <Skeleton className="mb-2 h-3 w-24" />
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-5/6" />
              </div>
            </div>
          ))}
        </div>
      ) : preview ? (
        <div className="space-y-5">
          {preview.source === 'template' ? (
            <InlineNote tone="accent">
              This structure came from a fixed template, not from AI. It is a starting point to
              edit.
            </InlineNote>
          ) : null}
          <div className="border-l-2 border-accent/50 pl-3">
            <p className="eyebrow mb-1">Why this shape</p>
            <p className="text-[12.5px] leading-6 text-ink/85">{preview.reasoning}</p>
          </div>

          {preview.kind === 'task' ? (
            <>
              {completedChildren.length > 0 ? (
                <InlineNote tone="sage">
                  {completedChildren.length} completed subtask
                  {completedChildren.length === 1 ? '' : 's'} will be preserved. These new steps
                  are added alongside them.
                </InlineNote>
              ) : null}
              <ul className="divide-y divide-line border border-line">
                {preview.subtasks.map((draft, index) => (
                  <li key={`${draft.title}-${index}`}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-3 px-3 py-2.5',
                        selectedTasks[index] ? 'bg-paper' : 'bg-surface2/40 text-muted',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(selectedTasks[index])}
                        onChange={() =>
                          setSelectedTasks((current) =>
                            current.map((value, itemIndex) =>
                              itemIndex === index ? !value : value,
                            ),
                          )
                        }
                        className="mt-0.5 h-3.5 w-3.5 accent-[rgb(var(--accent))]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] leading-5">{draft.title}</span>
                        {draft.description ? (
                          <span className="mt-0.5 block text-[11px] leading-5 text-muted">
                            {draft.description}
                          </span>
                        ) : null}
                      </span>
                      <span className="font-mono text-[9.5px] text-muted">
                        {draft.estimatedMinutes} min
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {preview.revisedEstimateMinutes ? (
                <p className="text-[11px] text-muted">
                  Parent estimate will become{' '}
                  <span className="font-mono text-ink">{preview.revisedEstimateMinutes} min</span>.
                </p>
              ) : null}
            </>
          ) : (
            <>
              {!targetProject ? (
                <Field label="Project name" htmlFor="decompose-project-title">
                  <Input
                    id="decompose-project-title"
                    value={projectTitle}
                    onChange={(event) => setProjectTitle(event.target.value)}
                    maxLength={140}
                  />
                </Field>
              ) : null}
              <div className="space-y-4">
                {(() => {
                  let cursor = 0;
                  return preview.phases.map((phase, phaseIndex) => {
                    const start = cursor;
                    cursor += phase.tasks.length;
                    const allSelected = phase.tasks.every(
                      (_, taskIndex) => selectedTasks[start + taskIndex],
                    );
                    return (
                      <section key={`${phase.title}-${phaseIndex}`} className="border border-line">
                        <header className="flex items-center justify-between gap-3 border-b border-line bg-surface2/30 px-3 py-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="font-mono text-[9px] text-accent">
                              {String(phaseIndex + 1).padStart(2, '0')}
                            </span>
                            <h3 className="truncate text-[12.5px] text-ink">{phase.title}</h3>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedTasks((current) => {
                                const next = [...current];
                                phase.tasks.forEach((_, taskIndex) => {
                                  next[start + taskIndex] = !allSelected;
                                });
                                return next;
                              })
                            }
                            className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-muted hover:text-ink"
                          >
                            {allSelected ? 'Deselect' : 'Select'}
                          </button>
                        </header>
                        <ul className="divide-y divide-line">
                          {phase.tasks.map((draft, taskIndex) => {
                            const index = start + taskIndex;
                            return (
                              <li key={`${draft.title}-${taskIndex}`}>
                                <label
                                  className={cn(
                                    'flex cursor-pointer items-start gap-3 px-3 py-2',
                                    selectedTasks[index] ? 'bg-paper' : 'bg-surface2/30 text-muted',
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={Boolean(selectedTasks[index])}
                                    onChange={() =>
                                      setSelectedTasks((current) =>
                                        current.map((value, itemIndex) =>
                                          itemIndex === index ? !value : value,
                                        ),
                                      )
                                    }
                                    className="mt-0.5 h-3.5 w-3.5 accent-[rgb(var(--accent))]"
                                  />
                                  <span className="min-w-0 flex-1 text-[12px] leading-5">
                                    {draft.title}
                                  </span>
                                  <span className="font-mono text-[9.5px] text-muted">
                                    {draft.estimatedMinutes} min
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    );
                  });
                })()}
              </div>
              <p className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted">
                {preview.phases.length} phases · {previewTaskCount} steps generated
              </p>
            </>
          )}

          {applyError ? <p className="text-[12px] text-accent">{applyError}</p> : null}
          <p className="border-t border-line pt-3 text-[10.5px] leading-5 text-muted">
            <Wand2 size={11} className="mr-1 inline" aria-hidden />
            You can edit, move or delete every generated step afterwards. Nothing happens without
            your confirmation.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {!aiReady ? (
            <div className="border border-line bg-surface2/40 px-4 py-3">
              <p className="text-[12px] font-medium text-ink">AI is not configured</p>
              <p className="mt-1 text-[11.5px] leading-5 text-muted">
                Add an OpenRouter key to let TakTic decompose tasks. Without one, you can use a
                fixed structural template — clearly labelled, and fully editable.{' '}
                <Link to="/settings#ai" className="text-accent underline decoration-accent/40 underline-offset-2">
                  Open AI settings
                </Link>
              </p>
            </div>
          ) : null}

          <Field
            label={task ? 'Task to break down' : 'The large task'}
            htmlFor="decompose-goal"
            required
            hint={
              task
                ? 'Additional steps will be added underneath this task.'
                : 'For example: “Complete my Biology research assignment on the human immune system.”'
            }
          >
            <Textarea
              id="decompose-goal"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              rows={3}
              maxLength={1200}
              placeholder="The thing you keep avoiding"
              data-autofocus="true"
              disabled={Boolean(task)}
            />
          </Field>

          {!task ? (
            <Field
              label="Extra context"
              htmlFor="decompose-context"
              hint="Requirements, scope, marking criteria — anything that changes the work."
            >
              <Textarea
                id="decompose-context"
                value={context}
                onChange={(event) => setContext(event.target.value)}
                rows={2}
                maxLength={800}
                placeholder="e.g. 2,000 words, due in nine days, must include three sources"
              />
            </Field>
          ) : (
            <InlineNote>
              The original task stays as the parent. Completed subtasks are preserved; new steps
              sit alongside them.
            </InlineNote>
          )}

          {targetProject ? (
            <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted">
              Target project · {targetProject.title}
            </p>
          ) : (
            <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted">
              A new project will be created
            </p>
          )}

          {error ? (
            <div className="border-l-2 border-accent pl-3">
              <p className="text-[12px] leading-5 text-ink">{error}</p>
              {aiReady ? (
                <button
                  type="button"
                  onClick={() => void generateWithAi()}
                  className="mt-1 text-[11.5px] text-accent underline decoration-accent/40 underline-offset-2"
                >
                  Try again
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <button
              type="button"
              onClick={generateTemplate}
              className="inline-flex items-center gap-1.5 text-[11.5px] text-muted underline decoration-line underline-offset-2 hover:text-ink"
            >
              <Check size={11} aria-hidden />
              Use a fixed template instead
            </button>
            <span className="ml-auto font-mono text-[9px] text-muted/70">
              never applied automatically
            </span>
          </div>
        </div>
      )}
    </Modal>
  );
}
