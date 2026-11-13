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
  md: 'h-1.5',
  lg: 'h-2.5',
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
      className={cn('w-full overflow-hidden bg-stone/60', heights[height], className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={label ?? 'Progress'}
    >
      <motion.div
        className={cn('h-full origin-left', tones[tone])}
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
        'flex flex-col items-center justify-center border border-dashed border-line bg-paper/40 px-6 text-center',
        compact ? 'py-8' : 'py-14',
      )}
    >
      {icon ? (
        <div className="mb-4 flex h-11 w-11 items-center justify-center border border-line bg-paper text-muted">
          {icon}
        </div>
      ) : null}
      {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
      <h3 className={cn('text-balance', compact ? 'text-[17px]' : 'text-[20px]')}>{title}</h3>
      {description ? (
        <p className="mt-2 max-w-sm text-[12.5px] leading-6 text-muted">{description}</p>
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
        'border-l-2 py-1 pl-3 text-[12px] leading-5',
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
