import type { ReactNode } from 'react';
import { CalendarClock, Flag, Layers } from 'lucide-react';
import type { Difficulty, Priority, Task } from '../../types';
import { cn } from '../../utils/cn';
import { deadlineInfo } from '../../utils/date';
import { DIFFICULTY_LABEL, PRIORITY_DOT, PRIORITY_LABEL } from '../../utils/tasks';

export function SealMark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center justify-center border border-accent font-serif text-accent', className)} aria-hidden>
      歩
    </span>
  );
}

export function Tag({
  children,
  className,
  icon,
}: {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border border-line px-1.5 py-[2px] font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-muted">
      <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_DOT[priority])} aria-hidden />
      <span className="font-mono">{PRIORITY_LABEL[priority]}</span>
    </span>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const filled = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-muted"
      title={`Difficulty: ${DIFFICULTY_LABEL[difficulty]}`}
    >
      <span className="flex items-end gap-[2px]" aria-hidden>
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={cn(
              'w-[3px]',
              index === 0 ? 'h-[5px]' : index === 1 ? 'h-[8px]' : 'h-[11px]',
              index < filled ? 'bg-ink/60' : 'bg-line',
            )}
          />
        ))}
      </span>
      <span className="font-mono">{DIFFICULTY_LABEL[difficulty]}</span>
    </span>
  );
}

export function DeadlineLabel({
  task,
  className,
}: {
  task: Pick<Task, 'deadline' | 'deadlineHasTime' | 'status'>;
  className?: string;
}) {
  if (!task.deadline) return null;
  const info = deadlineInfo(task.deadline, task.deadlineHasTime, task.status === 'completed');
  if (!info.label) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10.5px]',
        info.tone === 'overdue'
          ? 'text-accent'
          : info.tone === 'soon'
            ? 'text-ink/75'
            : 'text-muted',
        className,
      )}
      title={info.tone === 'overdue' ? 'Past the deadline' : info.label}
    >
      <CalendarClock size={11} aria-hidden />
      <span className="font-mono">{info.label}</span>
    </span>
  );
}

export function PriorityFlag({ priority }: { priority: Priority }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted">
      <Flag size={10} aria-hidden />
      <span className="font-mono uppercase tracking-[0.08em]">{PRIORITY_LABEL[priority]}</span>
    </span>
  );
}

export function TaskCount({ count, className }: { count: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] text-muted', className)}>
      <Layers size={10} aria-hidden />
      <span className="font-mono">{count} subtask{count === 1 ? '' : 's'}</span>
    </span>
  );
}

export function StatusPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'sage';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 border px-1.5 py-[2px] font-mono text-[9px] uppercase tracking-[0.12em]',
        tone === 'accent'
          ? 'border-accent/40 text-accent'
          : tone === 'sage'
            ? 'border-sage/50 text-sage'
            : 'border-line text-muted',
      )}
    >
      {children}
    </span>
  );
}
