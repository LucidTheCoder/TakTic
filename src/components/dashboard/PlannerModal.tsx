import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Sparkles, Trash2, Wand2 } from 'lucide-react';
import type { DailyPlan } from '../../types';
import { useTakTic } from '../../store/TakTicProvider';
import { useToast } from '../ui/ToastProvider';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Form';
import { EmptyState, InlineNote, Spinner } from '../ui/Feedback';
import { uid } from '../../utils/id';
import { formatTime, todayKey } from '../../utils/date';
import { openLeaves, incompleteDependencies } from '../../utils/tasks';
import { buildPlanFromRule, generateDailyPlan } from '../../services/ai';
import { describeAiError, isAiConfigured } from '../../services/ai/client';
import { cn } from '../../utils/cn';

interface PlannerModalProps {
  open: boolean;
  onClose: () => void;
}

export function PlannerModal({ open, onClose }: PlannerModalProps) {
  const { state, dispatch } = useTakTic();
  const { toast } = useToast();
  const [availableMinutes, setAvailableMinutes] = useState(state.settings.planner.availableMinutes);
  const [startHour, setStartHour] = useState(state.settings.planner.startHour);
  const [focusMinutes, setFocusMinutes] = useState(state.settings.planner.focusMinutes);
  const [preview, setPreview] = useState<Omit<DailyPlan, 'id' | 'createdAt'> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);

  const savedPlan = state.dailyPlans.find((plan) => plan.date === todayKey());
  const aiReady = isAiConfigured(state.settings.ai);
  const openTasks = useMemo(() => openLeaves(state.tasks), [state.tasks]);
  const eligible = useMemo(
    () => openTasks.filter((task) => incompleteDependencies(task, state.tasks).length === 0),
    [openTasks, state.tasks],
  );

  useEffect(() => {
    if (!open) return;
    setAvailableMinutes(state.settings.planner.availableMinutes);
    setStartHour(state.settings.planner.startHour);
    setFocusMinutes(state.settings.planner.focusMinutes);
    setPreview(null);
    setError(null);
    setInputError(null);
    setLoading(false);
  }, [open, state.settings.planner]);

  const validate = () => {
    if (availableMinutes < 15 || availableMinutes > 720) {
      setInputError('Choose between 15 minutes and 12 hours.');
      return false;
    }
    if (startHour < 0 || startHour > 23) {
      setInputError('Choose a start hour between 0 and 23.');
      return false;
    }
    if (focusMinutes < 5 || focusMinutes > 90) {
      setInputError('Focus blocks should be between 5 and 90 minutes.');
      return false;
    }
    setInputError(null);
    return true;
  };

  const generateAi = async () => {
    if (!validate()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await generateDailyPlan({
        tasks: openTasks,
        availableMinutes,
        startHour,
        focusMinutes,
        config: state.settings.ai,
      });
      setPreview(result);
    } catch (caught) {
      setError(describeAiError(caught));
    } finally {
      setLoading(false);
    }
  };

  const generateRuleBased = () => {
    if (!validate()) return;
    const result = buildPlanFromRule({
      tasks: eligible,
      availableMinutes,
      startHour,
      focusMinutes,
    });
    if (result.blocks.length === 0) {
      setError('There is not enough open time to fit a first block. Extend the window.');
      return;
    }
    setError(null);
    setPreview(result);
  };

  const accept = () => {
    if (!preview) return;
    dispatch({
      type: 'SAVE_PLAN',
      plan: {
        ...preview,
        blocks: preview.blocks.filter((block) => block.minutes > 0),
        id: uid('plan'),
        createdAt: new Date().toISOString(),
      },
    });
    toast({
      title: 'Plan saved',
      description: `${preview.blocks.filter((block) => block.kind === 'focus').length} focus blocks for today.`,
      tone: 'success',
    });
    onClose();
  };

  const totalFocus = preview
    ? preview.blocks
        .filter((block) => block.kind === 'focus')
        .reduce((sum, block) => sum + block.minutes, 0)
    : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Plan the day"
      eyebrow="Daily planner"
      description="A realistic shape for today, built from real task estimates and deadlines. You stay in control of every block."
      width="lg"
      footer={
        preview ? (
          <>
            <Button variant="ghost" onClick={() => setPreview(null)} className="mr-auto">
              Adjust inputs
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={accept} disabled={preview.blocks.length === 0}>
              Save this plan
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} className="mr-auto">
              Close
            </Button>
            <Button variant="secondary" onClick={generateRuleBased} disabled={eligible.length === 0}>
              Simple plan
            </Button>
            <Button variant="primary" onClick={() => void generateAi()} disabled={!aiReady || openTasks.length === 0}>
              {loading ? <Spinner className="border-paper/40 border-t-paper" /> : <Sparkles size={13} aria-hidden />}
              Plan with AI
            </Button>
          </>
        )
      }
    >
      {preview ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 border-b border-line pb-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">
              {preview.source === 'ai' ? 'AI plan' : 'Rule-based plan'}
            </span>
            <span className="font-mono text-[11px] text-muted">
              {preview.blocks.length} blocks · {totalFocus} focus min ·{' '}
              {Math.round((totalFocus / availableMinutes) * 100)}% of window
            </span>
            {preview.source === 'rule-based' ? (
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
                no AI used
              </span>
            ) : null}
          </div>
          <p className="text-[14px] leading-6 text-ink/85">{preview.summary}</p>
          <ul className="divide-y divide-line border border-line">
            {preview.blocks.map((block) => (
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
                  <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
                    {block.kind === 'longBreak' ? 'long break' : block.kind}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${block.label}`}
                  onClick={() =>
                    setPreview((current) =>
                      current
                        ? {
                            ...current,
                            blocks: current.blocks.filter((item) => item.id !== block.id),
                          }
                        : current,
                    )
                  }
                  className="mt-0.5 p-1 text-muted transition-colors hover:text-accent"
                >
                  <Trash2 size={12} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <InlineNote>
            Remove any block you do not want. Saving replaces today&apos;s saved plan; tasks
            themselves are not moved or rescheduled.
          </InlineNote>
        </div>
      ) : (
        <div className="space-y-5">
          {openTasks.length === 0 ? (
            <EmptyState
              compact
              icon={<CalendarRange size={18} aria-hidden />}
              title="No open tasks to plan"
              description="Add a task first, then return to shape the day around it."
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Available time" htmlFor="planner-available">
                  <div className="relative">
                    <Input
                      id="planner-available"
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
                <Field label="Start at" htmlFor="planner-start">
                  <Input
                    id="planner-start"
                    type="number"
                    min={0}
                    max={23}
                    value={startHour}
                    onChange={(event) => setStartHour(Number(event.target.value))}
                  />
                </Field>
                <Field label="Focus block" htmlFor="planner-focus">
                  <div className="relative">
                    <Input
                      id="planner-focus"
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

              {inputError ? <InlineNote tone="accent">{inputError}</InlineNote> : null}

              <div className="border border-line">
                <div className="flex items-center justify-between border-b border-line px-3 py-2">
                  <span className="eyebrow">Candidate tasks</span>
                  <span className="font-mono text-[11px] text-muted">
                    {eligible.length} ready · {openTasks.length - eligible.length} blocked
                  </span>
                </div>
                <ul className="max-h-48 divide-y divide-line overflow-y-auto">
                  {openTasks.slice(0, 12).map((task) => {
                    const waiting = incompleteDependencies(task, state.tasks).length > 0;
                    return (
                      <li
                        key={task.id}
                        className="flex items-center justify-between gap-3 px-3 py-2"
                      >
                        <span className="min-w-0 flex-1 truncate text-[14px] text-ink/85">
                          {task.title}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-muted">
                          {task.estimatedMinutes} min
                        </span>
                        {waiting ? (
                          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-accent">
                            blocked
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>

              {!aiReady ? (
                <InlineNote>
                  AI planning needs an OpenRouter key in Settings. The simple planner below uses
                  the same task data with fixed rules and no AI.
                </InlineNote>
              ) : null}

              {savedPlan ? (
                <div className="flex items-center justify-between gap-3 border border-line bg-surface2/40 px-3 py-2.5">
                  <div>
                    <p className="text-[13px] text-ink">
                      A plan is already saved for today ({savedPlan.blocks.filter((block) => block.kind === 'focus').length} focus blocks).
                    </p>
                    <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
                      {savedPlan.source}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'DELETE_PLAN', id: savedPlan.id })}
                    className="shrink-0 text-[12px] text-muted underline decoration-line underline-offset-2 hover:text-accent"
                  >
                    Remove
                  </button>
                </div>
              ) : null}

              {error ? (
                <div className="border-l-2 border-accent pl-3">
                  <p className="text-[14px] leading-5 text-ink">{error}</p>
                  <button
                    type="button"
                    onClick={generateRuleBased}
                    className="mt-1 inline-flex items-center gap-1 text-[13px] text-accent underline decoration-accent/40 underline-offset-2"
                  >
                    <Wand2 size={11} aria-hidden />
                    Build a simple plan instead
                  </button>
                </div>
              ) : null}

              <p className="border-t border-line pt-3 text-[12px] leading-5 text-muted">
                Blocked tasks are left out of the simple plan until their dependencies are done.
                Deadlines, priority and existing estimates decide the order. Nothing is scheduled
                without your approval.
              </p>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
