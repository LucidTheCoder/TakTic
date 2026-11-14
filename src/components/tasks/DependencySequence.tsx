import { useState } from 'react';
import { Check, Lock, Play } from 'lucide-react';
import type { Task } from '../../types';
import { incompleteDependencies, orderTasksByDependencies } from '../../utils/tasks';
import { cn } from '../../utils/cn';

interface DependencySequenceProps {
  tasks: Task[];
  allTasks: Task[];
  nextTaskId?: string | null;
  maxVisible?: number;
}

export function DependencySequence({
  tasks,
  allTasks,
  nextTaskId,
  maxVisible = 8,
}: DependencySequenceProps) {
  const [expanded, setExpanded] = useState(false);
  const ordered = orderTasksByDependencies(tasks, allTasks);
  const visible = expanded ? ordered : ordered.slice(0, maxVisible);

  if (ordered.length === 0) {
    return (
      <p className="text-[13px] leading-6 text-muted">
        Add actionable tasks to see a working sequence. Parent tasks are containers, not steps.
      </p>
    );
  }

  return (
    <div>
    <ol className="relative">
      {visible.map((task, index) => {
        const completed = task.status === 'completed';
        const waitingOn = incompleteDependencies(task, allTasks);
        const markedBlocked = task.status === 'blocked';
        const unavailable = waitingOn.length > 0 || markedBlocked;
        const isNext = !completed && !markedBlocked && nextTaskId === task.id;
        const last = index === visible.length - 1;
        return (
          <li key={task.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!last ? (
              <span
                className="absolute left-[11px] top-6 h-[calc(100%-14px)] w-px bg-line"
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                'relative z-[1] mt-0.5 flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full border font-mono text-[10px]',
                completed
                  ? 'border-sage bg-sage text-paper'
                  : unavailable
                    ? 'border-line bg-surface2 text-muted'
                    : 'border-accent/50 bg-paper text-accent',
              )}
              aria-hidden
            >
              {completed ? <Check size={11} strokeWidth={3} /> : String(index + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className={cn(
                    'text-[13px] leading-5',
                    completed ? 'text-muted line-through decoration-muted/40' : 'text-ink',
                  )}
                >
                  {task.title}
                </span>
                {isNext ? (
                  <span className="inline-flex items-center gap-1 border border-accent/30 bg-accent/5 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-accent">
                    <Play size={8} aria-hidden />
                    Start here
                  </span>
                ) : null}
              </div>
              {waitingOn.length > 0 ? (
                <p className="mt-0.5 text-[12px] leading-5 text-muted">
                  <Lock size={9} className="mr-1 inline" aria-hidden />
                  Waiting on {waitingOn.map((dependency) => dependency.title).join(' · ')}
                </p>
              ) : markedBlocked ? (
                <p className="mt-0.5 text-[12px] leading-5 text-muted">
                  <Lock size={9} className="mr-1 inline" aria-hidden />
                  {task.blockedReason ?? 'Marked as blocked'}
                </p>
              ) : completed ? (
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                  complete
                </p>
              ) : (
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                  ready · {task.estimatedMinutes} min
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
    {ordered.length > maxVisible ? (
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="mt-3 text-[12px] text-accent underline decoration-accent/40 underline-offset-2"
      >
        {expanded ? 'Show less' : `Show ${ordered.length - maxVisible} more step${ordered.length - maxVisible === 1 ? '' : 's'}`}
      </button>
    ) : null}
    </div>
  );
}
