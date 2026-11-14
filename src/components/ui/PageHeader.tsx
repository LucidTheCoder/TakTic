import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface PageHeaderProps {
  index: string;
  title: string;
  /** Kept for compatibility with older page call sites; not rendered. */
  jp?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  index,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('relative mb-8 border-b border-line pb-7 md:mb-10 md:pb-9', className)}>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[12px] tracking-[0.18em] text-accent">{index}</span>
        <span className="h-px w-8 bg-accent/35" aria-hidden />
        <span className="eyebrow">TakTic journal</span>
        <span className="ml-auto hidden font-mono text-[9px] uppercase tracking-[0.24em] text-muted/70 sm:block">
          One step at a time
        </span>
      </div>
      <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-8">
        <div className="min-w-0 flex-1 lg:max-w-[620px]">
          <h1 className="text-balance text-[38px] leading-[1.02] tracking-[-0.035em] md:text-[50px]">
            {title}
          </h1>
          {description ? (
            <p className="mt-3 max-w-[620px] text-[15px] leading-7 text-ink/60 md:text-[16px]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-4', className)}>
      <div>
        {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
        <h2 className="text-[23px] leading-snug text-ink">{title}</h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
