import { Link, NavLink } from 'react-router-dom';
import { Command, Compass, Settings } from 'lucide-react';
import { NAV_GROUPS } from '../../data/navigation';
import { useTakTic } from '../../store/TakTicProvider';
import { ProgressBar } from '../ui/Feedback';
import { cn } from '../../utils/cn';
import { TakTicLogo } from '../brand/TakTicLogo';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'T';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

interface SidebarProps {
  onOpenPalette: () => void;
  onOpenTour: () => void;
}

export function Sidebar({ onOpenPalette, onOpenTour }: SidebarProps) {
  const { state, stats } = useTakTic();
  const level = stats.level;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-line bg-ivory/92 backdrop-blur-xl lg:flex">
      <div className="px-6 pb-5 pt-7">
        <Link to="/" className="group inline-flex" aria-label="TakTic home">
          <TakTicLogo markClassName="h-10 w-10 transition-transform duration-200 group-hover:-translate-y-0.5" />
        </Link>
        <div className="mt-5 flex items-center justify-between gap-2 border-t border-line pt-3">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted/80">
            Personal edition
          </span>
          {state.demoLoaded ? (
            <span className="inline-flex items-center gap-1.5 rounded-[5px] border border-accent/30 bg-accent-soft/25 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-accent">
              <span className="h-1 w-1 rounded-full bg-accent" aria-hidden />
              Demo
            </span>
          ) : null}
        </div>
      </div>

      <nav className="scroll-thin flex-1 overflow-y-auto px-3 pb-3" aria-label="Main">
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={group.label} className={groupIndex === 0 ? '' : 'mt-4 border-t border-line/80 pt-3'}>
            <div className="mb-1.5 flex items-center gap-2 px-2.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted/80">
                {group.label}
              </span>
              <span className="h-px flex-1 bg-line/70" aria-hidden />
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      end={item.path === '/'}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex items-center gap-3 rounded-[8px] px-2.5 py-2 text-[13px] transition-colors duration-200',
                          isActive
                            ? 'bg-accent/[0.09] font-medium text-ink'
                            : 'text-muted hover:bg-paper/65 hover:text-ink',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={cn(
                              'absolute inset-y-2 left-0 w-[2px] rounded-full transition-colors',
                              isActive ? 'bg-accent' : 'bg-transparent',
                            )}
                            aria-hidden
                          />
                          <Icon
                            size={16}
                            className={isActive ? 'text-accent' : 'text-muted group-hover:text-ink'}
                            strokeWidth={1.7}
                            aria-hidden
                          />
                          <span className="flex-1">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <div className="mt-4 border-t border-line/80 pt-3">
          <button
            type="button"
            onClick={onOpenTour}
            className="group flex w-full items-center gap-3 rounded-[8px] px-2.5 py-2 text-left text-[13px] text-muted transition-colors hover:bg-paper/65 hover:text-ink"
          >
            <Compass size={16} strokeWidth={1.7} aria-hidden />
            <span className="flex-1">Help</span>
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted/50">
              Tour
            </span>
          </button>
        </div>
      </nav>

      <div className="border-t border-line px-4 pb-4 pt-3.5">
        <button
          type="button"
          onClick={onOpenPalette}
          className="mb-4 flex w-full items-center gap-2 rounded-[8px] border border-line bg-paper/70 px-2.5 py-2 text-left text-[12px] text-muted transition-colors hover:border-ink/25 hover:bg-paper hover:text-ink"
        >
          <Command size={12} aria-hidden />
          <span className="flex-1">Search & commands</span>
          <kbd className="border border-line bg-ivory/70 px-1 py-[1px] font-mono text-[9px] text-muted">
            Ctrl K
          </kbd>
        </button>

        <Link
          to="/settings"
          className="group flex items-center gap-2.5"
          aria-label="Open profile settings"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-line bg-paper font-mono text-[11px] tracking-wide text-ink transition-colors group-hover:border-accent/60">
            {state.profile.avatar || initials(state.profile.displayName)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] text-ink">
              {state.profile.displayName}
            </span>
            <span className="mt-0.5 block font-mono text-[10px] text-muted">
              Level {level.level} · {level.title}
            </span>
          </span>
          <Settings
            size={13}
            className="text-muted transition-colors group-hover:text-ink"
            aria-hidden
          />
        </Link>
        <div className="mt-3">
          <ProgressBar value={level.percent} height="sm" label="Level progress" />
          <div
            className="mt-1.5 flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.06em] text-muted"
            title={`${level.totalXp} total XP`}
          >
            <span>Level progress</span>
            <span>{level.intoLevel} / {level.forNext} XP</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
