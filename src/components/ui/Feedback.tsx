import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

interface ProgressBarProps {
  value: number;
  tone?: 'accent' | 'sage' | 'muted';
  height?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

const heights = {
  sm: 'h-[3px]',
  md: 'h-[6px]',
  lg: 'h-[8px]',
};

const tones = {
  accent: 'bg-accent',
  sage: 'bg-sage',
  muted: 'bg-muted/60',
};

export function ProgressBar({
  value,
  tone = 'accent',
  height = 'md',
  label,
  className,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className={cn('w-full overflow-hidden rounded-full bg-stone/65', heights[height], className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={label ?? 'Progress'}
    >
      <motion.div
        className={cn('h-full origin-left rounded-full', tones[tone])}
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}

/** A small stationery illustration: layered sheets, an ink mark and one seal. */
function PaperStack({ icon }: { icon?: ReactNode }) {
  return (
    <div className="relative mb-5 h-[58px] w-[68px]" aria-hidden>
      <span className="absolute left-1 top-1.5 h-[44px] w-[50px] -rotate-6 rounded-[3px] border border-line/80 bg-surface2/40" />
      <span className="absolute left-3 top-0.5 h-[44px] w-[50px] rotate-3 rounded-[3px] border border-line/80 bg-surface2/25" />
      <span className="relative flex h-[46px] w-[52px] items-center justify-center overflow-hidden rounded-[3px] border border-line bg-paper text-muted shadow-paper">
        <span className="absolute inset-x-0 top-0 h-px bg-accent/45" />
        {icon ?? <span className="h-1.5 w-1.5 rounded-full bg-accent/60" />}
        <span className="absolute bottom-1.5 right-1.5 h-[3px] w-3 bg-line" />
      </span>
      <span className="absolute -right-0.5 top-1 h-1.5 w-1.5 bg-accent/80" />
    </div>
  );
}

export function EmptyState({
  icon,
  eyebrow,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'paper-panel flex flex-col items-center justify-center rounded-[14px] border border-line bg-paper/70 px-6 text-center',
        compact ? 'py-8' : 'py-12 sm:py-14',
      )}
    >
      <PaperStack icon={icon} />
      {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
      <h3 className={cn('text-balance', compact ? 'text-[20px]' : 'text-[24px]')}>{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-[14px] leading-6 text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-[1.5px] border-line border-t-accent',
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse bg-stone/50', className)}
      aria-hidden
    />
  );
}

export function InlineNote({
  children,
  tone = 'default',
  className,
}: {
  children: ReactNode;
  tone?: 'default' | 'accent' | 'sage';
  className?: string;
}) {
  return (
    <p
      className={cn(
        'border-l-2 py-1 pl-3 text-[15px] leading-6',
        tone === 'accent'
          ? 'border-accent/60 text-ink/80'
          : tone === 'sage'
            ? 'border-sage/60 text-ink/80'
            : 'border-line text-muted',
        className,
      )}
    >
      {children}
    </p>
  );
}
