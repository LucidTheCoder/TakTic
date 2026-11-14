import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { ToastProvider } from './components/ui/ToastProvider';
import { TakTicProvider, useTakTic } from './store/TakTicProvider';
import { AppActionsProvider } from './components/app/AppActionsProvider';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { TasksPage } from './pages/TasksPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { FocusRoomPage } from './pages/FocusRoomPage';
import { CompanionPage } from './pages/CompanionPage';
import { CalendarPage } from './pages/CalendarPage';
import { StatisticsPage } from './pages/StatisticsPage';
import { AchievementsPage } from './pages/AchievementsPage';
import { SettingsPage } from './pages/SettingsPage';
import { EmptyState } from './components/ui/Feedback';
import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <EmptyState
      eyebrow="Not found"
      title="That page is not on the shelf."
      description="The address may be old, or the section may have moved."
      action={
        <Link
          to="/"
          className="inline-flex h-9 items-center border border-accent bg-accent px-4 text-[14px] text-paper"
        >
          Back to the dashboard
        </Link>
      }
    />
  );
}

function AppearanceSync() {
  const { state } = useTakTic();
  const location = useLocation();
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (!hash) return;
    const timer = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [location.hash, location.pathname]);
  return (
    <span className="hidden" aria-hidden>
      {state.profile.displayName}
    </span>
  );
}

function MotionShell({ children }: { children: ReactNode }) {
  const { state } = useTakTic();
  return (
    <MotionConfig reducedMotion={state.profile.preferences.reducedMotion ? 'always' : 'user'}>
      {children}
    </MotionConfig>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <TakTicProvider>
          <MotionShell>
            <AppActionsProvider>
              <AppearanceSync />
              <Routes>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/tasks" element={<TasksPage />} />
                  <Route path="/projects" element={<ProjectsPage />} />
                  <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
                  <Route path="/focus" element={<FocusRoomPage />} />
                  <Route path="/companion" element={<CompanionPage />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/statistics" element={<StatisticsPage />} />
                  <Route path="/achievements" element={<AchievementsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </AppActionsProvider>
          </MotionShell>
        </TakTicProvider>
      </BrowserRouter>
    </ToastProvider>
  );
}
