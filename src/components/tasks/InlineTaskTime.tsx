import { useRef, useState } from 'react';
import { CalendarClock, Check, Clock3, PencilLine, X } from 'lucide-react';
import type { Task } from '../../types';
import { useTakTic } from '../../store/TakTicProvider';
import { useToast } from '../ui/ToastProvider';
import { DeadlineLabel } from '../ui/Badges';
import { cn } from '../../utils/cn';
import { formatDateKey, formatDuration, todayKey, toDateKey } from '../../utils/date';

const inputClass =
  'h-8 min-w-0 rounded-[5px] border border-accent/45 bg-paper px-1.5 text-[16px] text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent/25 sm:h-7 sm:text-[12px]';

function timeValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function InlineDuration({ task }: { task: Task }) {
  const { dispatch } = useTakTic();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(task.estimatedMinutes));
  const wrapperRef = useRef<HTMLSpanElement>(null);

  const begin = () => {
    setDraft(String(task.estimatedMinutes));
    setEditing(true);
  };

  const commit = () => {
    const next = Math.round(Number(draft));
    if (!Number.isFinite(next) || next < 1 || next > 1440) {
      toast({
        title: 'Enter a valid duration',
        description: 'Use a whole number of minutes between 1 and 1440.',
        tone: 'error',
      });
      return;
    }
    if (next !== task.estimatedMinutes) {
      dispatch({ type: 'UPDATE_TASK', id: task.id, patch: { estimatedMinutes: next } });
      toast({
        title: 'Duration updated',
        description: `${task.title} · ${formatDuration(next)}`,
        tone: 'success',
      });
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <span
        ref={wrapperRef}
        className="inline-flex items-center gap-1"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) commit();
        }}
      >
        <Clock3 size={11} className="text-muted" aria-hidden />
        <form
          className="inline-flex items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            commit();
          }}
        >
          <input
            autoFocus
            type="number"
            inputMode="numeric"
            min={1}
            max={1440}
            step={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setEditing(false);
              }
            }}
            className={cn(inputClass, 'w-16')}
            aria-label={`Estimated minutes for ${task.title}`}
          />
          <span className="text-[11px] text-muted">min</span>
          <button
            type="submit"
            className="flex h-8 w-8 items-center justify-center text-accent hover:bg-accent/10"
            aria-label="Save duration"
          >
            <Check size={13} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="flex h-8 w-8 items-center justify-center text-muted hover:bg-surface2"
            aria-label="Cancel duration edit"
          >
            <X size={12} aria-hidden />
          </button>
        </form>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={begin}
      className="group/inline inline-flex items-center gap-1 rounded-[3px] text-[12px] text-muted transition-colors hover:text-ink focus-visible:text-ink"
      title="Click to edit estimated duration"
      aria-label={`Estimated duration ${formatDuration(task.estimatedMinutes)}. Edit.`}
    >
      <Clock3 size={11} aria-hidden />
      <span className="tabular-nums">{formatDuration(task.estimatedMinutes)}</span>
              <PencilLine
        size={9}
        className="opacity-50 transition-opacity group-hover/inline:opacity-70 group-focus-visible/inline:opacity-70 sm:opacity-0"
        aria-hidden
      />
    </button>
  );
}

export function InlineDeadline({ task }: { task: Task }) {
  const { dispatch } = useTakTic();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [dateDraft, setDateDraft] = useState('');
  const [timeDraft, setTimeDraft] = useState('');

  const begin = () => {
    setDateDraft(task.deadline ? toDateKey(task.deadline) : todayKey());
    setTimeDraft(task.deadlineHasTime ? timeValue(task.deadline) : '');
    setEditing(true);
  };

  const commit = () => {
    if (!dateDraft) {
      if (task.deadline) {
        dispatch({
          type: 'UPDATE_TASK',
          id: task.id,
          patch: { deadline: null, deadlineHasTime: false },
        });
        toast({ title: 'Deadline removed', description: task.title, tone: 'success' });
      }
      setEditing(false);
      return;
    }

    const unchanged =
      Boolean(task.deadline) &&
      toDateKey(task.deadline as string) === dateDraft &&
      task.deadlineHasTime === Boolean(timeDraft) &&
      (!timeDraft || timeValue(task.deadline) === timeDraft);
    if (unchanged) {
      setEditing(false);
      return;
    }

    const time = timeDraft || '23:59';
    const next = new Date(`${dateDraft}T${time}:00`);
    if (Number.isNaN(next.getTime())) {
      toast({
        title: 'Enter a valid deadline',
        description: 'Choose a real date and time, or clear the field.',
        tone: 'error',
      });
      return;
    }

    dispatch({
      type: 'UPDATE_TASK',
      id: task.id,
      patch: { deadline: next.toISOString(), deadlineHasTime: Boolean(timeDraft) },
    });
    toast({
      title: 'Deadline updated',
      description: `${task.title} · ${formatDateKey(dateDraft, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })}${timeDraft ? ` at ${timeDraft}` : ''}`,
      tone: 'success',
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <span
        className="inline-flex flex-wrap items-center gap-1"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) commit();
        }}
      >
        <CalendarClock size={11} className="text-muted" aria-hidden />
        <form
          className="inline-flex flex-wrap items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            commit();
          }}
        >
          <input
            autoFocus
            type="date"
            value={dateDraft}
            onChange={(event) => setDateDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setEditing(false);
              }
            }}
            className={inputClass}
            aria-label={`Deadline date for ${task.title}`}
          />
          <input
            type="time"
            value={timeDraft}
            onChange={(event) => setTimeDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setEditing(false);
              }
            }}
            className={cn(inputClass, 'w-[86px]')}
            aria-label={`Deadline time for ${task.title}, optional`}
          />
          <button
            type="submit"
            className="flex h-8 w-8 items-center justify-center text-accent hover:bg-accent/10"
            aria-label="Save deadline"
          >
            <Check size={13} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="flex h-8 w-8 items-center justify-center text-muted hover:bg-surface2"
            aria-label="Cancel deadline edit"
          >
            <X size={12} aria-hidden />
          </button>
        </form>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={begin}
      className="group/inline inline-flex items-center gap-1 rounded-[3px] text-[12px] text-muted transition-colors hover:text-ink focus-visible:text-ink"
      title="Click to edit deadline"
      aria-label={
        task.deadline
          ? 'Edit deadline'
          : `Add a deadline for ${task.title}`
      }
    >
      {task.deadline ? (
        <DeadlineLabel task={task} />
      ) : (
        <>
          <CalendarClock size={11} aria-hidden />
          Add deadline
        </>
      )}
              <PencilLine
        size={9}
        className="opacity-50 transition-opacity group-hover/inline:opacity-70 group-focus-visible/inline:opacity-70 sm:opacity-0"
        aria-hidden
      />
    </button>
  );
}
