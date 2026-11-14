import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Compass,
  FolderOpen,
  LayoutGrid,
  ListChecks,
  Menu,
  MessageCircle,
  Search,
  Timer,
  X,
} from 'lucide-react';
import { NAV_ITEMS } from '../../data/navigation';
import { cn } from '../../utils/cn';

const primary = [
  { path: '/', label: 'Home', icon: LayoutGrid },
  { path: '/tasks', label: 'Tasks', icon: ListChecks },
  { path: '/focus', label: 'Focus', icon: Timer },
  { path: '/companion', label: 'Ask AI', icon: MessageCircle },
  { path: '/projects', label: 'Projects', icon: FolderOpen },
];

interface MobileNavProps {
  onOpenPalette: () => void;
  onOpenTour: () => void;
}

export function MobileNav({ onOpenPalette, onOpenTour }: MobileNavProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const location = useLocation();
  const moreActive =
    !primary.some((item) => item.path === location.pathname) &&
    location.pathname !== '/';

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Primary mobile"
      >
        <div className="mx-auto grid max-w-2xl grid-cols-6">
          {primary.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex h-[58px] flex-col items-center justify-center gap-1 text-[10px] tracking-wide transition-colors',
                    isActive ? 'text-accent' : 'text-muted',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={17} strokeWidth={isActive ? 2 : 1.5} aria-hidden />
                    <span>{item.label}</span>
                    <span
                      className={cn(
                        'h-[2px] w-4',
                        isActive ? 'bg-accent' : 'bg-transparent',
                      )}
                      aria-hidden
                    />
                  </>
                )}
              </NavLink>
            );
          })}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className={cn(
              'flex h-[58px] flex-col items-center justify-center gap-1 text-[10px] tracking-wide transition-colors',
              moreActive || sheetOpen ? 'text-accent' : 'text-muted',
            )}
            aria-label="More sections"
            aria-expanded={sheetOpen}
          >
            <Menu size={17} strokeWidth={moreActive || sheetOpen ? 2 : 1.5} aria-hidden />
            <span>More</span>
            <span
              className={cn('h-[2px] w-4', moreActive || sheetOpen ? 'bg-accent' : 'bg-transparent')}
              aria-hidden
            />
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {sheetOpen ? (
          <div className="fixed inset-0 z-[95] lg:hidden">
            <motion.button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-ink/35 backdrop-blur-[1px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheetOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto border-t border-line bg-paper pb-[calc(76px+env(safe-area-inset-bottom))] shadow-lift"
              role="dialog"
              aria-label="All sections"
            >
              <div className="sticky top-0 flex items-center justify-between border-b border-line bg-paper px-5 py-3.5">
                <div>
                  <p className="eyebrow">Contents</p>
                  <p className="mt-0.5 font-serif text-[19px]">Sections</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="p-1 text-muted hover:text-ink"
                  aria-label="Close menu"
                >
                  <X size={17} aria-hidden />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-px bg-line">
                <button
                  type="button"
                  onClick={() => {
                    setSheetOpen(false);
                    onOpenPalette();
                  }}
                  className="col-span-2 flex items-center gap-2 bg-paper px-4 py-3 text-left text-[14px] text-ink"
                >
                  <Search size={15} className="text-accent" aria-hidden />
                  Search and commands
                  <span className="ml-auto font-mono text-[11px] text-muted">Ctrl K</span>
                </button>
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setSheetOpen(false)}
                      className="flex items-center gap-2 bg-paper px-4 py-3.5 text-[14px] text-ink"
                    >
                      <Icon size={16} className="text-muted" aria-hidden />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setSheetOpen(false);
                    onOpenTour();
                  }}
                  className="col-span-2 flex items-center gap-2 border-t border-line bg-paper px-4 py-3.5 text-left text-[14px] text-ink"
                >
                  <Compass size={16} className="text-muted" aria-hidden />
                  <span className="flex-1">Help</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted/60">
                    Quick tour
                  </span>
                </button>
              </div>
              <p className="px-5 pt-4 text-[12px] leading-5 text-muted">
                TakTic keeps everything on this device. Export a backup from Settings whenever
                you want.
              </p>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
