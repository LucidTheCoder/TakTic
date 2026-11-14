import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  Check,
  Clock3,
  ListTree,
  LifeBuoy,
  Route,
  Timer,
  Wand2,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/Feedback';
import { cn } from '../../utils/cn';

const TOUR_KEY = 'taktic.onboarding.v1';
const TOUR_VERSION = 1;
const TOTAL_STEPS = 5;

interface TourRecord {
  version: number;
  lastStep: number;
  completedAt: string | null;
  dismissedAt: string | null;
}

function readTourRecord(): TourRecord {
  try {
    const raw = localStorage.getItem(TOUR_KEY);
    if (!raw) {
      return { version: TOUR_VERSION, lastStep: 0, completedAt: null, dismissedAt: null };
    }
    const parsed = JSON.parse(raw) as Partial<TourRecord>;
    if (parsed.version !== TOUR_VERSION) {
      return { version: TOUR_VERSION, lastStep: 0, completedAt: null, dismissedAt: null };
    }
    return {
      version: TOUR_VERSION,
      lastStep:
        typeof parsed.lastStep === 'number'
          ? Math.max(0, Math.min(TOTAL_STEPS - 1, parsed.lastStep))
          : 0,
      completedAt: typeof parsed.completedAt === 'string' ? parsed.completedAt : null,
      dismissedAt: typeof parsed.dismissedAt === 'string' ? parsed.dismissedAt : null,
    };
  } catch {
    return { version: TOUR_VERSION, lastStep: 0, completedAt: null, dismissedAt: null };
  }
}

function writeTourRecord(record: TourRecord) {
  try {
    localStorage.setItem(TOUR_KEY, JSON.stringify(record));
  } catch {
    // The tour is optional; a blocked storage write must never break the app.
  }
}

interface StepDefinition {
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof Route;
  visual: ReactNode;
}

const STEPS: StepDefinition[] = [
  {
    eyebrow: 'Start with the whole thing',
    title: 'Bring the overwhelming assignment, not a perfect plan.',
    description:
      'Describe the work in the same words you would use out loud. TakTic handles the first act of breaking it apart.',
    icon: Wand2,
    visual: (
      <div className="border border-line bg-surface2/35 px-4 py-4">
        <p className="eyebrow">Example assignment</p>
        <p className="mt-2 font-serif text-[20px] leading-snug text-ink">
          “Complete my biology research assignment by Friday.”
        </p>
        <div className="mt-3 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
          <span className="border border-line bg-paper px-2 py-1">due Friday</span>
          <span className="border border-line bg-paper px-2 py-1">no steps yet</span>
          <span className="border border-line bg-paper px-2 py-1">that is enough</span>
        </div>
      </div>
    ),
  },
  {
    eyebrow: 'See the shape of the work',
    title: 'A large assignment becomes phases and small actions.',
    description:
      'TakTic proposes phases, realistic estimates, priorities and dependencies. You review the plan before anything changes.',
    icon: ListTree,
    visual: (
      <div className="space-y-2">
        {[
          { phase: '01', title: 'Research', detail: 'Choose sources · gather evidence', width: '72%' },
          { phase: '02', title: 'Draft', detail: 'Thesis · outline · first section', width: '48%' },
          { phase: '03', title: 'Finish', detail: 'Revise · format · submit', width: '26%' },
        ].map((row) => (
          <div key={row.phase} className="border border-line bg-paper px-3.5 py-3">
            <div className="flex items-start gap-3">
              <span className="font-mono text-[10px] tracking-[0.12em] text-accent">{row.phase}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] text-ink">{row.title}</p>
                <p className="mt-0.5 text-[12px] text-muted">{row.detail}</p>
                <div className="mt-2 h-1 w-full bg-stone/60">
                  <div className="h-full bg-sage/70" style={{ width: row.width }} />
                </div>
              </div>
            </div>
          </div>
        ))}
        <p className="pt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
          Illustrative example · nothing is saved
        </p>
      </div>
    ),
  },
  {
    eyebrow: 'Find the next action',
    title: 'Start where the dependencies allow, not where the panic points.',
    description:
      'The first executable step is marked clearly. Anything waiting on another task explains what it is waiting for.',
    icon: Route,
    visual: (
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="border border-sage/50 bg-sage-soft/40 px-3.5 py-3">
          <span className="inline-flex items-center gap-1 border border-sage/40 bg-paper px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-sage">
            <Check size={8} aria-hidden /> start here
          </span>
          <p className="mt-2 text-[14px] text-ink">Choose two credible sources</p>
          <p className="mt-1 font-mono text-[10px] text-muted">20 min · no prerequisites</p>
        </div>
        <div className="border border-line bg-paper px-3.5 py-3">
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">waiting</span>
          <p className="mt-2 text-[14px] text-ink">Write the first draft</p>
          <p className="mt-1 text-[12px] text-muted">Waiting on: gather evidence</p>
        </div>
        <div className="border border-line bg-paper px-3.5 py-3 sm:col-span-2">
          <p className="text-[12px] leading-5 text-muted">
            Urgency does not override order. Independent steps can still happen in parallel.
          </p>
        </div>
      </div>
    ),
  },
  {
    eyebrow: 'When you get stuck',
    title: 'Tell TakTic what kind of stuck this is.',
    description:
      'The response changes with the obstacle. It proposes a different route instead of asking you to try harder.',
    icon: LifeBuoy,
    visual: (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {[
            'I don’t know where to start',
            'This task feels too big',
            'I don’t understand the topic',
            'I’m struggling to concentrate',
            'The estimate is unrealistic',
          ].map((label, index) => (
            <span
              key={label}
              className={cn(
                'border px-2.5 py-1 text-[12px]',
                index === 1
                  ? 'border-accent bg-accent-soft/45 text-accent'
                  : 'border-line bg-paper text-muted',
              )}
            >
              {label}
            </span>
          ))}
        </div>
        <div className="border border-accent/30 bg-accent-soft/20 px-3.5 py-3">
          <p className="eyebrow text-accent">A different route</p>
          <p className="mt-1 text-[13px] leading-5 text-ink/80">
            Spend ten minutes listing what you already know. Then choose only the next paragraph,
            not the whole draft.
          </p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
            Proposed for review · applied only with your approval
          </p>
        </div>
      </div>
    ),
  },
  {
    eyebrow: 'Make progress visible',
    title: 'Focus, finish, and keep a record without pressure.',
    description:
      'Use the Focus Room for one honest block. Progress, XP and statistics come from what you actually did.',
    icon: Timer,
    visual: (
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          { icon: Timer, label: 'Focus Room', value: '25 min' },
          { icon: Clock3, label: 'Next step', value: 'one task' },
          { icon: Check, label: 'Record', value: 'real actions' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="border border-line bg-paper px-3 py-3">
              <Icon size={14} className="text-accent" aria-hidden />
              <p className="mt-2 font-mono text-[16px] text-ink">{item.value}</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">{item.label}</p>
            </div>
          );
        })}
        <p className="border-t border-line pt-3 text-[13px] leading-5 text-muted sm:col-span-3">
          Start with the first step on your own dashboard. You can reopen this tour from the command
          palette whenever you want it.
        </p>
      </div>
    ),
  },
];

export function GuidedTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const stepRef = useRef(step);
  stepRef.current = step;
  const current = STEPS[step];
  const isLast = step === TOTAL_STEPS - 1;

  useEffect(() => {
    if (!open) return;
    const record = readTourRecord();
    const resumable = !record.completedAt && !record.dismissedAt && record.lastStep > 0;
    setStep(resumable ? record.lastStep : 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const record = readTourRecord();
    writeTourRecord({ ...record, lastStep: step, dismissedAt: null });
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setStep((value) => Math.min(TOTAL_STEPS - 1, value + 1));
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setStep((value) => Math.max(0, value - 1));
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const dismiss = useCallback(() => {
    const record = readTourRecord();
    writeTourRecord({
      ...record,
      lastStep: stepRef.current,
      dismissedAt: new Date().toISOString(),
    });
    onClose();
  }, [onClose]);

  const finish = () => {
    const record = readTourRecord();
    writeTourRecord({
      ...record,
      lastStep: TOTAL_STEPS - 1,
      completedAt: new Date().toISOString(),
      dismissedAt: null,
    });
    onClose();
  };

  const Icon = current.icon;

  return (
    <Modal
      open={open}
      onClose={dismiss}
      width="lg"
      eyebrow={`Quick tour · ${step + 1} of ${TOTAL_STEPS}`}
      title={current.title}
      description={current.description}
      footer={
        <>
          <Button
            variant="ghost"
            onClick={dismiss}
            className="sm:mr-auto"
            aria-label="Skip the quick tour"
          >
            Skip
          </Button>
          <Button
            variant="secondary"
            onClick={() => setStep((value) => Math.max(0, value - 1))}
            disabled={step === 0}
          >
            Back
          </Button>
          <Button
            variant="primary"
            data-autofocus
            onClick={() => {
              if (isLast) finish();
              else setStep((value) => Math.min(TOTAL_STEPS - 1, value + 1));
            }}
          >
            {isLast ? 'Finish tour' : 'Next'}
            <ArrowRight size={13} aria-hidden />
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-line text-accent">
            <Icon size={15} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <ProgressBar
              value={((step + 1) / TOTAL_STEPS) * 100}
              height="sm"
              label={`Tour progress, step ${step + 1} of ${TOTAL_STEPS}`}
            />
          </div>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
            {step + 1} / {TOTAL_STEPS}
          </span>
        </div>

        <p className="eyebrow">{current.eyebrow}</p>
        <div aria-live="polite">{current.visual}</div>

        <p className="border-t border-line pt-3 text-[12px] leading-5 text-muted">
          Example content only. This tour never creates tasks, changes your workspace, awards XP or
          sends an AI request.
        </p>
      </div>
    </Modal>
  );
}
