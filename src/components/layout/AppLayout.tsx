import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Command, Search } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { LevelUpOverlay } from './LevelUpOverlay';
import { useTakTic } from '../../store/TakTicProvider';
import { useAppActions } from '../app/AppActionsProvider';
import { useToast } from '../ui/ToastProvider';
import { pageMeta } from '../../data/navigation';
import { TakTicLogo } from '../brand/TakTicLogo';

export function AppLayout() {
  const { state } = useTakTic();
  const { openPalette } = useAppActions();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const meta = pageMeta(location.pathname);
  const theme = state.profile.preferences.theme;
  const accent = state.profile.preferences.accent;
  const seenBreak = useRef<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.dataset.accent = accent;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    metaTheme?.setAttribute('content', theme === 'dark' ? '#1A1B19' : '#F5F1E8');
  }, [theme, accent]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  useEffect(() => {
    const sessions = [...state.focusSessions].sort((a, b) =>
      b.startTime.localeCompare(a.startTime),
    );
    const latest = sessions[0];
    if (!latest || latest.type === 'focus') return;
    if (seenBreak.current === latest.id) return;
    seenBreak.current = latest.id;
    if (Date.now() - new Date(latest.endTime).getTime() > 20_000) return;
    if (!state.settings.notifications.inApp || !state.settings.notifications.focus) return;
    toast({
      title: 'Break finished',
      description: 'Return when you are ready. A short focus block is enough.',
      tone: 'default',
      duration: 6000,
      action: {
        label: 'Open focus room',
        onClick: () => navigate('/focus'),
      },
    });
  }, [
    state.focusSessions,
    state.settings.notifications.inApp,
    state.settings.notifications.focus,
    toast,
    navigate,
  ]);

  return (
    <div className="relative min-h-screen bg-ivory">
      <div className="grain pointer-events-none fixed inset-0 z-0" aria-hidden />
      <Sidebar onOpenPalette={() => openPalette('command')} />

      <div className="relative z-10 lg:pl-[264px]">
        <header className="sticky top-0 z-30 border-b border-line bg-ivory/95 backdrop-blur lg:hidden">
          <div className="flex h-[52px] items-center gap-3 px-4">
            <Link to="/" className="flex items-center" aria-label="TakTic home">
              <TakTicLogo
                showTagline={false}
                markClassName="h-6 w-6"
                textClassName="text-[17px] tracking-[-0.01em]"
              />
            </Link>
            <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              {meta.index} / {meta.label}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => openPalette('search')}
                className="flex h-8 w-8 items-center justify-center text-muted transition-colors hover:text-ink"
                aria-label="Search workspace"
              >
                <Search size={16} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => openPalette('command')}
                className="flex h-8 w-8 items-center justify-center text-muted transition-colors hover:text-ink"
                aria-label="Open command palette"
              >
                <Command size={16} aria-hidden />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1180px] px-4 pb-32 pt-6 sm:px-6 md:px-8 md:pt-8 lg:px-10 lg:pb-20 lg:pt-10">
          {state.demoLoaded ? (
            <div className="mb-5 flex flex-col gap-2 border border-accent/30 bg-accent-soft/30 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
              <span className="w-fit rounded-[6px] border border-accent/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-accent">
                Demo workspace
              </span>
              <p className="min-w-0 flex-1 text-[12px] leading-5 text-ink/75">
                This is the demonstration workspace. Sample content can be removed without
                affecting a non-demo workspace.
              </p>
              <Link
                to="/settings#data"
                className="w-fit shrink-0 text-[12px] text-accent underline decoration-accent/40 underline-offset-2"
              >
                Manage demo data
              </Link>
            </div>
          ) : null}
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </main>

        <footer className="mx-auto hidden w-full max-w-[1180px] items-center justify-between px-10 pb-8 font-mono text-[10px] uppercase tracking-[0.14em] text-muted/70 lg:flex">
          <span>TakTic · one step at a time</span>
          <button
            type="button"
            onClick={() => openPalette('command')}
            className="inline-flex items-center gap-1.5 transition-colors hover:text-ink"
          >
            <Command size={10} aria-hidden />
            Command palette · Ctrl K
          </button>
          <span>Local workspace</span>
        </footer>
      </div>

      <MobileNav onOpenPalette={() => openPalette('command')} />
      <LevelUpOverlay />
    </div>
  );
}
