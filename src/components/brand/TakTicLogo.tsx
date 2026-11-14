import { cn } from '../../utils/cn';

type MarkTone = 'brand' | 'mono' | 'inverse';

interface TakTicMarkProps {
  className?: string;
  tone?: MarkTone;
  title?: string;
}

/**
 * The Stepping T: three offset work tiles settle into a single forward stem.
 * It reads as a T at small sizes and as a progression from fragments to one
 * clear next action. The geometry is deliberately blocky so it survives 16px.
 */
export function TakTicMark({ className, tone = 'brand', title }: TakTicMarkProps) {
  const primary =
    tone === 'mono'
      ? 'currentColor'
      : tone === 'inverse'
        ? 'rgb(var(--paper))'
        : 'rgb(var(--accent))';
  const secondary =
    tone === 'mono'
      ? 'currentColor'
      : tone === 'inverse'
        ? 'rgb(var(--paper))'
        : 'rgb(var(--sage))';

  return (
    <svg
      viewBox="0 0 32 32"
      className={cn('block', className)}
      fill="none"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <rect x="2.5" y="10" width="9.5" height="6.5" rx="1.4" fill={secondary} />
      <rect x="12" y="7" width="8" height="9.5" rx="1.4" fill={primary} />
      <rect x="20" y="10" width="9.5" height="6.5" rx="1.4" fill={primary} opacity="0.72" />
      <rect x="13.5" y="7" width="5" height="21.5" rx="2" fill={primary} />
    </svg>
  );
}

interface TakTicLogoProps {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  showTagline?: boolean;
  tone?: 'brand' | 'inverse';
}

export function TakTicLogo({
  className,
  markClassName,
  textClassName,
  showTagline = true,
  tone = 'brand',
}: TakTicLogoProps) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2.5', className)}>
      <TakTicMark
        tone={tone === 'inverse' ? 'inverse' : 'brand'}
        className={cn('h-8 w-8 shrink-0', markClassName)}
      />
      <span className="flex min-w-0 flex-col">
        <span
          className={cn(
            'font-serif text-[22px] leading-none tracking-[-0.02em]',
            tone === 'inverse' ? 'text-paper' : 'text-ink',
            textClassName,
          )}
        >
          TakTic
        </span>
        {showTagline ? (
          <span
            className={cn(
              'mt-1 font-mono text-[9px] uppercase leading-none tracking-[0.22em]',
              tone === 'inverse' ? 'text-paper/65' : 'text-muted',
            )}
          >
            one step at a time
          </span>
        ) : null}
      </span>
    </span>
  );
}

export function TakTicAppIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-[10px] bg-accent',
        className ?? 'h-8 w-8',
      )}
      aria-hidden
    >
      <TakTicMark tone="inverse" className="h-[72%] w-[72%]" />
    </span>
  );
}
