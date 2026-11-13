import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface PageHeaderProps {
  index: string;
  title: string;
  jp: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  index,
  title,
  jp,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('mb-8 border-b border-line pb-6 md:mb-10 md:pb-7', className)}>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] tracking-[0.18em] text-accent">{index}</span>
        <span className="h-px w-7 bg-line" aria-hidden />
        <span className="eyebrow">{jp}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h1 className="text-balance text-[30px] leading-[1.15] md:text-[38px]">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-xl text-[12.5px] leading-6 text-muted">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
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
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h2 className="text-[17px] leading-snug text-ink">{title}</h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
