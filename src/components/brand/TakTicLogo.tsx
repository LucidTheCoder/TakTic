import { cn } from '../../utils/cn';

type MarkTone = 'brand' | 'mono' | 'inverse';

interface TakTicMarkProps {
  className?: string;
  tone?: MarkTone;
  title?: string;
}

const BRAND_GREEN = '#9BCC8D';

/**
 * The supplied TakTic mark: a rounded frame, a decisive check and three
 * right-aligned task lines. The frame is part of the mark, so callers should
 * not wrap it in another bordered tile.
 */
export function TakTicMark({ className, tone = 'brand', title }: TakTicMarkProps) {
  const color =
    tone === 'mono'
      ? 'currentColor'
      : tone === 'inverse'
        ? 'rgb(var(--paper))'
        : BRAND_GREEN;

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
      <rect
        x="1.875"
        y="1.875"
        width="28.25"
        height="28.25"
        rx="6.2"
        stroke={color}
        strokeWidth="0.8"
      />
      <path
        d="M5.55 13.9 10.2 20.3 17.9 10.05"
        stroke={color}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="19.1" y="12.45" width="8.3" height="2.1" rx="1.05" fill={color} />
      <rect x="15.95" y="15.8" width="11.45" height="2.1" rx="1.05" fill={color} />
      <rect x="13.3" y="19.15" width="14.1" height="2.1" rx="1.05" fill={color} />
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
  return <TakTicMark className={cn('block shrink-0', className ?? 'h-8 w-8')} />;
}
