import { Link, NavLink } from 'react-router-dom';
import { Command, Settings } from 'lucide-react';
import { NAV_ITEMS } from '../../data/navigation';
import { useTakTic } from '../../store/TakTicProvider';
import { ProgressBar } from '../ui/Feedback';
import { cn } from '../../utils/cn';
import { formatLongDate } from '../../utils/date';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'T';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

interface SidebarProps {
  onOpenPalette: () => void;
}

export function Sidebar({ onOpenPalette }: SidebarProps) {
  const { state, stats } = useTakTic();
  const level = stats.level;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-line bg-ivory lg:flex">
      <div className="px-6 pb-4 pt-6">
        <Link to="/" className="group flex items-center gap-2.5" aria-label="TakTic home">
          <span className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-accent font-serif text-[17px] leading-none text-accent transition-colors group-hover:bg-accent group-hover:text-paper">
            T
          </span>
          <span className="flex flex-col">
            <span className="font-serif text-[22px] leading-none tracking-[-0.015em] text-ink">
              TakTic
            </span>
            <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
              one step at a time
            </span>
          </span>
        </Link>
        <p className="mt-5 border-t border-line pt-3 text-[12px] leading-5 text-muted">
          {formatLongDate()}
        </p>
        {state.demoLoaded ? (
          <p className="mt-2 inline-flex items-center gap-1.5 border border-accent/30 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
            <span className="h-1 w-1 rounded-full bg-accent" aria-hidden />
            Demo workspace
          </p>
        ) : null}
      </div>

      <nav className="scroll-thin flex-1 overflow-y-auto px-3" aria-label="Main">
        <div className="mb-2 flex items-center justify-between px-2.5">
          <span className="eyebrow">Workspace</span>
        </div>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center gap-3 px-2.5 py-2.5 text-[14px] transition-colors',
                      isActive
                        ? 'bg-paper text-ink'
                        : 'text-muted hover:bg-paper/70 hover:text-ink',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          'absolute inset-y-1.5 left-0 w-[2px] transition-colors',
                          isActive ? 'bg-accent' : 'bg-transparent',
                        )}
                        aria-hidden
                      />
                      <Icon
                        size={15}
                        className={isActive ? 'text-accent' : 'text-muted group-hover:text-ink'}
                        strokeWidth={1.6}
                        aria-hidden
                      />
                      <span className="flex-1">{item.label}</span>
                      <span className="font-mono text-[10px] tracking-[0.08em] text-muted/60">
                        {item.index}
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-line px-4 pb-4 pt-3.5">
        <button
          type="button"
          onClick={onOpenPalette}
          className="mb-4 flex w-full items-center gap-2 border border-line bg-paper px-2.5 py-2 text-left text-[13px] text-muted transition-colors hover:border-ink/25 hover:text-ink"
        >
          <Command size={12} aria-hidden />
          <span className="flex-1">Search & commands</span>
          <kbd className="border border-line px-1 py-[1px] font-mono text-[10px] text-muted">
            Ctrl K
          </kbd>
        </button>

        <Link
          to="/settings"
          className="group flex items-center gap-2.5"
          aria-label="Open profile settings"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-line bg-paper font-mono text-[12px] tracking-wide text-ink transition-colors group-hover:border-accent">
            {state.profile.avatar || initials(state.profile.displayName)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] text-ink">
              {state.profile.displayName}
            </span>
            <span className="mt-0.5 block font-mono text-[11px] text-muted">
              Level {level.level} · {level.title}
            </span>
          </span>
          <Settings
            size={13}
            className="text-muted transition-colors group-hover:text-ink"
            aria-hidden
          />
        </Link>
        <div className="mt-2.5">
          <ProgressBar value={level.percent} height="sm" label="Level progress" />
          <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-muted">
            <span>{level.intoLevel} XP</span>
            <span>{level.forNext} XP</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
