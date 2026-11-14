import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FolderOpen,
  Pencil,
  Plus,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useTakTic } from '../store/TakTicProvider';
import { useAppActions } from '../components/app/AppActionsProvider';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/Modal';
import { EmptyState, InlineNote, ProgressBar } from '../components/ui/Feedback';
import { PriorityBadge, StatusPill } from '../components/ui/Badges';
import { TaskRow } from '../components/tasks/TaskRow';
import { FEEDBACK_OPTIONS } from '../data/feedback';
import { formatDateKey, humanRelative } from '../utils/date';
import { cn } from '../utils/cn';
import { formatDuration } from '../utils/date';
import { orderTasksByDependencies, projectProgress, projectTasks } from '../utils/tasks';

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { state, dispatch, captureSnapshot, offerUndo } = useTakTic();
  const { openProject, openTask, openDecompose } = useAppActions();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const project = state.projects.find((candidate) => candidate.id === projectId);

  const roots = useMemo(() => {
    if (!project) return [];
    const tasks = projectTasks(state.tasks, project.id);
    return orderTasksByDependencies(
      tasks.filter((task) => !task.parentTaskId),
      tasks,
    );
  }, [state.tasks, project]);

  const adaptations = useMemo(() => {
    if (!project) return [];
    const taskIds = new Set(projectTasks(state.tasks, project.id).map((task) => task.id));
    return state.adaptations
      .filter((record) => taskIds.has(record.taskId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 4);
  }, [state.adaptations, state.tasks, project]);

  if (!project) {
    return (
      <EmptyState
        eyebrow="Project missing"
        title="That project is not here."
        description="It may have been deleted. Completed history and XP remain in your ledger."
        action={
          <Link to="/projects" className="inline-flex h-9 items-center border border-line px-4 text-[14px] hover:border-ink/30">
            All projects
          </Link>
        }
      />
    );
  }

  const progress = projectProgress(project, state.tasks);
  const tasks = projectTasks(state.tasks, project.id);
  const totalEstimated = tasks
    .filter((task) => task.childTaskIds.length === 0)
    .reduce((sum, task) => sum + task.estimatedMinutes, 0);
  const completed = project.status === 'completed';
  const deadlineLabel = project.deadline
    ? formatDateKey(project.deadline.slice(0, 10), {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'No deadline';

  const handleDelete = () => {
    const snapshot = captureSnapshot();
    dispatch({ type: 'DELETE_PROJECT', id: project.id });
    setDeleteOpen(false);
    navigate('/projects');
    offerUndo(
      'Project deleted',
      snapshot,
      `${tasks.length} task${tasks.length === 1 ? '' : 's'} removed. Earned XP remains in your ledger.`,
    );
  };

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted hover:text-ink"
        >
          <ArrowLeft size={11} aria-hidden />
          All projects
        </Link>
      </div>

      <PageHeader
        index="03"
        jp=""
        title={project.title}
        description={project.description || undefined}
        actions={
          <>
            <Button variant="ghost" onClick={() => openProject(project.id)}>
              <Pencil size={12} aria-hidden />
              Edit
            </Button>
            <Button variant="secondary" onClick={() => openDecompose({ projectId: project.id })}>
              <Wand2 size={13} aria-hidden />
              Split a big task
            </Button>
            <Button variant="primary" onClick={() => openTask({ projectId: project.id })}>
              <Plus size={13} aria-hidden />
              Add task
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete project"
              onClick={() => setDeleteOpen(true)}
              className="text-accent hover:text-accent"
            >
              <Trash2 size={14} aria-hidden />
            </Button>
          </>
        }
      />

      <div className="mb-2 flex flex-wrap items-center gap-3">
        <PriorityBadge priority={project.priority} />
        <span className="h-3 w-px bg-line" aria-hidden />
        <StatusPill tone={completed ? 'sage' : 'neutral'}>
          {completed ? 'Completed' : project.status}
        </StatusPill>
        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
          <CalendarClock size={11} aria-hidden />
          {deadlineLabel}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
          <Clock3 size={11} aria-hidden />
          {formatDuration(totalEstimated)} estimated
        </span>
      </div>

      {completed ? (
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 border border-sage/40 bg-sage-soft/50 px-4 py-3">
          <CheckCircle2 size={16} className="text-sage" aria-hidden />
          <p className="text-[14px] text-ink">
            Project complete
            {project.completedAt
              ? ` on ${formatDateKey(project.completedAt.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' })}`
              : ''}.
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
            {state.settings.xp.project} XP awarded once · recorded in the ledger
          </p>
        </div>
      ) : null}

      <section className="mb-6 border border-line bg-paper p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-1">Completion</p>
            <p className="font-mono text-[48px] leading-none tracking-[-0.04em] text-ink">
              {progress.percent}
              <span className="ml-1 text-[16px] text-muted">%</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-right">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">Completed</p>
              <p className="font-mono text-[18px] text-ink">{progress.completed}</p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">Remaining</p>
              <p className="font-mono text-[18px] text-ink">{progress.remaining}</p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">Actionable</p>
              <p className="font-mono text-[18px] text-ink">{progress.total}</p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">Adaptations</p>
              <p className="font-mono text-[18px] text-ink">{adaptations.length}</p>
            </div>
          </div>
        </div>
        <ProgressBar
          value={progress.percent}
          tone={completed ? 'sage' : 'accent'}
          height="lg"
          className="mt-4"
          label={`${project.title} completion`}
        />
        <p className="mt-2 text-[12px] leading-5 text-muted">
          Parent tasks are containers and are never counted twice. {progress.hasTasks
            ? `Completion is ${progress.completed} leaf tasks out of ${progress.total}.`
            : 'Add an actionable task to begin measuring progress.'}
        </p>
      </section>

      <section className="mb-6 border border-line bg-paper">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <p className="eyebrow">Task hierarchy</p>
            <h2 className="mt-0.5 text-[17px]">Steps and phases</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => openTask({ projectId: project.id })}>
              <Plus size={12} aria-hidden />
              Add
            </Button>
            <Button variant="secondary" size="sm" onClick={() => openDecompose({ projectId: project.id })}>
              <Wand2 size={12} aria-hidden />
              Split a big task
            </Button>
          </div>
        </div>
        {state.tasks.filter((task) => task.projectId === project.id).length === 0 ? (
          <div className="p-4">
            <EmptyState
              compact
              icon={<FolderOpen size={17} aria-hidden />}
              title="This project is only a title."
              description="Add a first actionable step, or let TakTic break the project into phases and small tasks."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button size="sm" variant="primary" onClick={() => openTask({ projectId: project.id })}>
                    Add a task
                  </Button>
                  <Button size="sm" variant="quiet" onClick={() => openDecompose({ projectId: project.id })}>
                    Split with AI
                  </Button>
                </div>
              }
            />
          </div>
        ) : (
          <div>
            {roots.map((task) => (
              <TaskRow key={task.id} task={task} showProject={false} />
            ))}
          </div>
        )}
        {roots.length === 0 && tasks.length > 0 ? (
          <p className="px-4 py-3 text-[13px] text-muted">
            All tasks in this project are nested. They are visible through their parent rows above
            after opening a task from the list.
          </p>
        ) : null}
      </section>

      <section className="border border-line bg-paper p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Adaptation history</p>
            <h2 className="mt-1 text-[17px]">How the work changed shape</h2>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
            {adaptations.length} recent record{adaptations.length === 1 ? '' : 's'}
          </p>
        </div>
        {adaptations.length === 0 ? (
          <p className="mt-3 border-t border-line pt-3 text-[13px] leading-6 text-muted">
            No task in this project has been adapted yet. On any difficult step, choose “Having
            trouble?” and the task can be restructured while completed work is preserved.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {adaptations.map((record) => {
              const task = state.tasks.find((candidate) => candidate.id === record.taskId);
              const feedback = FEEDBACK_OPTIONS.find((option) => option.id === record.feedbackType);
              return (
                <li key={record.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] text-ink">{task?.title ?? 'Deleted task'}</span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
                      {feedback?.label ?? record.feedbackType}
                    </span>
                    <span className="ml-auto font-mono text-[11px] text-muted">
                      {humanRelative(record.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] leading-5 text-muted">{record.reasoning}</p>
                  {record.generatedTasks.length > 0 ? (
                    <p className="mt-1 font-mono text-[11px] leading-5 text-muted/80">
                      + {record.generatedTasks.slice(0, 4).join(' · ')}
                      {record.generatedTasks.length > 4 ? ' …' : ''}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
        <span>Created {new Date(project.createdAt).toLocaleDateString('en-GB')}</span>
        <span>Updated {new Date(project.updatedAt).toLocaleDateString('en-GB')}</span>
        <span className={cn(completed ? 'text-sage' : '')}>Status: {project.status}</span>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete this project?"
        description={`The project and its ${tasks.length} task${tasks.length === 1 ? '' : 's'} will be removed. XP already earned is not removed from the ledger. Focus history keeps its recorded sessions.`}
        confirmLabel="Delete project"
        tone="danger"
      />

      <InlineNote className="mt-4">
        A project is never marked complete by a button. It completes when every actionable leaf
        task is finished.
      </InlineNote>
    </div>
  );
}
