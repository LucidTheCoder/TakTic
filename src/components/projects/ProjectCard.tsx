import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarClock, CheckCircle2 } from 'lucide-react';
import type { Project, Task } from '../../types';
import { ProgressBar } from '../ui/Feedback';
import { PriorityBadge } from '../ui/Badges';
import { cn } from '../../utils/cn';
import { deadlineInfo, formatDateKey } from '../../utils/date';
import { projectProgress } from '../../utils/tasks';

export function ProjectCard({ project, tasks }: { project: Project; tasks: Task[] }) {
  const progress = projectProgress(project, tasks);
  const deadline = project.deadline
    ? deadlineInfo(project.deadline, false, project.status === 'completed')
    : null;
  const completed = project.status === 'completed';

  return (
    <Link
      to={`/projects/${project.id}`}
      className={cn(
        'group flex h-full flex-col border border-line bg-paper p-5 transition-colors hover:border-ink/25',
        completed && 'bg-surface2/25',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
            {completed ? 'Completed' : 'Active'}
          </span>
          <span className="h-2.5 w-px bg-line" aria-hidden />
          <PriorityBadge priority={project.priority} />
        </div>
        <ArrowUpRight
          size={15}
          className="shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
          aria-hidden
        />
      </div>

      <h3 className="mt-2.5 line-clamp-2 text-[18px] leading-snug text-ink">{project.title}</h3>
      <p className="mt-1.5 line-clamp-2 min-h-[2.6rem] text-[13px] leading-5 text-muted">
        {project.description || 'No description yet.'}
      </p>

      <div className="mt-auto pt-5">
        <div className="mb-1.5 flex items-end justify-between gap-3">
          <span className="font-mono text-[24px] leading-none tracking-[-0.03em] text-ink">
            {progress.percent}
            <span className="ml-0.5 text-[13px] text-muted">%</span>
          </span>
          <span className="font-mono text-[11px] text-muted">
            {progress.completed} / {progress.total} tasks
          </span>
        </div>
        <ProgressBar
          value={progress.percent}
          tone={completed ? 'sage' : 'accent'}
          height="md"
          label={`${project.title} completion`}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1">
            {completed ? (
              <>
                <CheckCircle2 size={11} className="text-sage" aria-hidden />
                {project.completedAt
                  ? `Finished ${formatDateKey(project.completedAt.slice(0, 10), { day: 'numeric', month: 'short' })}`
                  : 'Complete'}
              </>
            ) : (
              <>
                <CalendarClock size={11} aria-hidden />
                {deadline?.label ?? 'No deadline'}
              </>
            )}
          </span>
          <span className="font-mono">
            {progress.remaining} remaining
          </span>
        </div>
      </div>
    </Link>
  );
}
