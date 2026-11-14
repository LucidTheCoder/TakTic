import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Coffee, Lock, Trash2 } from 'lucide-react';
import { useTakTic } from '../../store/TakTicProvider';
import { useToast } from '../ui/ToastProvider';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Form';
import { EmptyState, InlineNote } from '../ui/Feedback';
import { formatTime } from '../../utils/date';
import { uid } from '../../utils/id';
import { buildCatchUpPlan } from '../../services/planner/catchup';
import { cn } from '../../utils/cn';

interface CatchUpModalProps {
  open: boolean;
  onClose: () => void;
}

export function CatchUpModal({ open, onClose }: CatchUpModalProps) {
  const { state, dispatch } = useTakTic();
  const { toast } = useToast();
  const [availableMinutes, setAvailableMinutes] = useState(state.settings.planner.availableMinutes);
  const [startHour, setStartHour] = useState(state.settings.planner.startHour);
  const [focusMinutes, setFocusMinutes] = useState(state.settings.planner.focusMinutes);
  const [removedBlocks, setRemovedBlocks] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setAvailableMinutes(state.settings.planner.availableMinutes);
    setStartHour(state.settings.planner.startHour);
    setFocusMinutes(state.settings.planner.focusMinutes);
    setRemovedBlocks(new Set());
  }, [open, state.settings.planner]);

  useEffect(() => {
    setRemovedBlocks(new Set());
  }, [availableMinutes, startHour, focusMinutes]);

  const windowError =
    availableMinutes < 15 || availableMinutes > 720
      ? 'Choose between 15 minutes and 12 hours.'
      : startHour < 0 || startHour > 23
        ? 'Choose a start hour between 0 and 23.'
        : focusMinutes < 5 || focusMinutes > 90
          ? 'Focus blocks should be between 5 and 90 minutes.'
          : startHour * 60 + availableMinutes > 24 * 60
            ? 'That window runs past midnight. Choose an earlier start or a shorter window.'
            : null;

  const result = useMemo(
    () =>
      buildCatchUpPlan({
        tasks: state.tasks,
        availableMinutes,
        startHour,
        focusMinutes,
      }),
    [state.tasks, availableMinutes, startHour, focusMinutes],
  );

  const visibleBlocks = result.plan.blocks.filter((block) => !removedBlocks.has(block.id));
  const visibleFocus = visibleBlocks.filter((block) => block.kind === 'focus');
  const visibleFocusMinutes = visibleFocus.reduce((sum, block) => sum + block.minutes, 0);
  const summary =
    removedBlocks.size === 0
      ? result.plan.summary
      : `${visibleFocus.length} focus block${visibleFocus.length === 1 ? '' : 's'} in ${visibleFocusMinutes} minutes after your edits. ${result.postponed.length} startable step${result.postponed.length === 1 ? '' : 's'} still stay for later.`;

  const accept = () => {
    if (visibleFocus.length === 0 || windowError) return;
    dispatch({
      type: 'SAVE_PLAN',
      plan: {
        ...result.plan,
        blocks: visibleBlocks,
        summary,
        source: 'rule-based',
        id: uid('plan'),
        createdAt: new Date().toISOString(),
      },
    });
    toast({
      title: 'Catch-up plan saved',
      description: `${visibleFocus.length} focus block${visibleFocus.length === 1 ? '' : 's'} for today. Tasks were not moved.`,
      tone: 'success',
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Help me catch up"
      eyebrow="Recovery plan"
      description="Let's work out what we can realistically get done today."
      width="lg"
      footer={
        visibleFocus.length > 0 && !windowError ? (
          <>
            <Button variant="ghost" onClick={onClose} className="mr-auto">
              Reject for now
            </Button>
            <Button variant="primary" onClick={accept}>
              Save this catch-up plan
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={onClose} className="ml-auto">
            Close
          </Button>
        )
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
          {[
            { label: 'Outstanding', value: result.startableCount + result.blocked.length },
            { label: 'Overdue', value: result.overdueCount, alert: result.overdueCount > 0 },
            { label: 'Ready now', value: result.startableCount },
            { label: 'Waiting', value: result.blocked.length },
          ].map((item) => (
            <div key={item.label} className="bg-paper px-3 py-2.5">
              <p className="eyebrow mb-1">{item.label}</p>
              <p
                className={cn(
                  'font-mono text-[20px] leading-none',
                  item.alert ? 'text-accent' : 'text-ink',
                )}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Time available" htmlFor="catchup-available">
            <div className="relative">
              <Input
                id="catchup-available"
                type="number"
                min={15}
                max={720}
                step={15}
                value={availableMinutes}
                onChange={(event) => setAvailableMinutes(Number(event.target.value))}
                className="pr-12"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[12px] text-muted">
                min
              </span>
            </div>
          </Field>
          <Field label="Start at" htmlFor="catchup-start">
            <Input
              id="catchup-start"
              type="number"
              min={0}
              max={23}
              value={startHour}
              onChange={(event) => setStartHour(Number(event.target.value))}
            />
          </Field>
          <Field label="Focus block" htmlFor="catchup-focus">
            <div className="relative">
              <Input
                id="catchup-focus"
                type="number"
                min={5}
                max={90}
                step={5}
                value={focusMinutes}
                onChange={(event) => setFocusMinutes(Number(event.target.value))}
                className="pr-12"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[12px] text-muted">
                min
              </span>
            </div>
          </Field>
        </div>

        {windowError ? <InlineNote tone="accent">{windowError}</InlineNote> : null}

        {result.startableCount === 0 ? (
          <EmptyState
            compact
            icon={<CalendarClock size={17} aria-hidden />}
            title={result.blocked.length > 0 ? 'Nothing can start yet.' : 'Nothing is outstanding.'}
            description={
              result.blocked.length > 0
                ? 'Every open step is waiting on a prerequisite or was marked blocked. The waiting list below shows exactly what is missing.'
                : 'There is no open work to recover. A quiet catch-up is still a valid outcome.'
            }
          />
        ) : visibleFocus.length === 0 ? (
          <EmptyState
            compact
            icon={<Coffee size={17} aria-hidden />}
            title="No block fits this window."
            description="That is a fact about the time, not a failure. Extend the window, or split a large task into a smaller first step."
          />
        ) : (
          <>
            <div className="border-l-2 border-accent/50 pl-3">
              <p className="eyebrow mb-1">The shape of today</p>
              <p className="text-[14px] leading-6 text-ink/85">{summary}</p>
            </div>

            <ul className="divide-y divide-line border border-line">
              {visibleBlocks.map((block) => (
                <li
                  key={block.id}
                  className={cn(
                    'flex items-start gap-3 px-3 py-2.5',
                    block.kind === 'focus' ? 'bg-paper' : 'bg-surface2/35',
                  )}
                >
                  <span className="w-[92px] shrink-0 font-mono text-[12px] text-muted">
                    {formatTime(block.start)}–{formatTime(block.end)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block text-[14px] leading-5',
                        block.kind === 'focus' ? 'text-ink' : 'text-muted',
                      )}
                    >
                      {block.label}
                    </span>
                    <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                      {block.kind === 'focus'
                        ? `${result.rationales[block.taskId ?? ''] ?? 'ready to start'}`
                        : block.kind === 'longBreak'
                          ? 'long break'
                          : 'short break'}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${block.label}`}
                    onClick={() =>
                      setRemovedBlocks((current) => {
                        const next = new Set(current);
                        next.add(block.id);
                        return next;
                      })
                    }
                    className="mt-0.5 p-1 text-muted transition-colors hover:text-accent"
                  >
                    <Trash2 size={12} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>

            <InlineNote>
              This plan uses fixed rules and your stored task data — no AI request. Saving replaces
              today&apos;s saved plan; tasks themselves are not moved, postponed or completed.
            </InlineNote>
          </>
        )}

        {result.postponed.length > 0 ? (
          <div className="border-t border-line pt-3">
            <p className="eyebrow mb-2">Left for later</p>
            <ul className="space-y-1.5">
              {result.postponed.slice(0, 4).map(({ task, reason }) => (
                <li key={task.id} className="text-[13px] leading-5">
                  <span className="text-ink">{task.title}</span>
                  <span className="text-muted"> — {reason}</span>
                </li>
              ))}
            </ul>
            {result.postponed.length > 4 ? (
              <p className="mt-1 font-mono text-[11px] text-muted">
                and {result.postponed.length - 4} more
              </p>
            ) : null}
          </div>
        ) : null}

        {result.blocked.length > 0 ? (
          <div className="border-t border-line pt-3">
            <p className="eyebrow mb-2 inline-flex items-center gap-1.5">
              <Lock size={10} aria-hidden />
              Waiting on prerequisites
            </p>
            <ul className="space-y-1.5">
              {result.blocked.slice(0, 4).map(({ task, reason }) => (
                <li key={task.id} className="text-[13px] leading-5">
                  <span className="text-ink">{task.title}</span>
                  <span className="text-muted"> — {reason}</span>
                </li>
              ))}
            </ul>
            {result.blocked.length > 4 ? (
              <p className="mt-1 font-mono text-[11px] text-muted">
                and {result.blocked.length - 4} more
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
