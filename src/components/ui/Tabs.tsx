import { cn } from '../../utils/cn';

interface TabBarProps<T extends string> {
  items: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
}

export function TabBar<T extends string>({
  items,
  value,
  onChange,
  className,
  ariaLabel = 'Views',
}: TabBarProps<T>) {
  return (
    <div
      className={cn('no-scrollbar flex gap-5 overflow-x-auto border-b border-line', className)}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative -mb-px flex shrink-0 items-center gap-1.5 border-b-[1.5px] pb-2.5 pt-1 text-[14px] transition-colors',
              active
                ? 'border-accent text-ink'
                : 'border-transparent text-muted hover:border-line hover:text-ink/80',
            )}
          >
            {item.label}
            {typeof item.count === 'number' ? (
              <span
                className={cn(
                  'font-mono text-[11px]',
                  active ? 'text-accent' : 'text-muted/80',
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

interface SegmentedProps<T extends string> {
  items: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function Segmented<T extends string>({
  items,
  value,
  onChange,
  className,
  size = 'md',
}: SegmentedProps<T>) {
  return (
    <div
      className={cn('inline-flex border border-line bg-paper p-[2px]', className)}
      role="group"
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'px-3 transition-colors',
              size === 'sm' ? 'py-1 text-[12px]' : 'py-1.5 text-[13px]',
              active
                ? 'bg-accent text-paper'
                : 'text-muted hover:bg-surface2 hover:text-ink',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
