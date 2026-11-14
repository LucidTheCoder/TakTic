import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarRange,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Flame,
  FolderOpen,
  MessageCircle,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Target,
  Timer,
  Trophy,
  Wand2,
} from 'lucide-react';
import type { DashboardWidgetId } from '../types';
import { useTakTic } from '../store/TakTicProvider';
import { useAppActions } from '../components/app/AppActionsProvider';
import { useToast } from '../components/ui/ToastProvider';
import { Button, buttonClass } from '../components/ui/Button';
import { ProgressBar, EmptyState } from '../components/ui/Feedback';
import { AchievementIcon } from '../components/gamification/AchievementIcon';
import { PriorityBadge } from '../components/ui/Badges';
import { TaskRow } from '../components/tasks/TaskRow';
import { ACHIEVEMENTS } from '../services/gamification/achievements';
import { defaultSettings } from '../services/gamification/xp';
import { formatDateKey, greetingForHour, humanRelative, todayKey, formatDuration } from '../utils/date';
import { deadlineInfo } from '../utils/date';
import { cn } from '../utils/cn';

const WIDGETS: Array<{ id: DashboardWidgetId; label: string; description: string }> = [
  { id: 'dailyProgress', label: "Today's progress", description: 'Completion of tasks scheduled today' },
  { id: 'progression', label: 'Your progress', description: 'XP, level and activity streak' },
  { id: 'todayTasks', label: "Today's tasks", description: 'Tasks scheduled or due today' },
  { id: 'objectives', label: "Today's goals", description: 'Three small targets for today' },
  { id: 'activeProjects', label: 'Active projects', description: 'Progress across your projects' },
  { id: 'deadlines', label: 'Upcoming deadlines', description: 'The nearest open due dates' },
  { id: 'focusStats', label: 'Focus statistics', description: 'Today and this week in focus time' },
  { id: 'recentAchievements', label: 'Recent achievements', description: 'Your latest unlocks' },
  { id: 'companionNote', label: 'AI note', description: 'A note drawn from your workspace' },
];

const SPANS: Record<DashboardWidgetId, string> = {
  dailyProgress: 'lg:col-span-5',
  progression: 'lg:col-span-4',
  todayTasks: 'lg:col-span-7',
  objectives: 'lg:col-span-4',
  activeProjects: 'lg:col-span-7',
  deadlines: 'lg:col-span-4',
  focusStats: 'lg:col-span-5',
  recentAchievements: 'lg:col-span-6',
  companionNote: 'lg:col-span-6',
};

function companionNote(
  stats: ReturnType<typeof import('../store/selectors').derive>,
): string {
  if (stats.todayProgress.total === 0) {
    return 'Nothing is scheduled today. Choose one small step and give it a time, or leave the day open on purpose.';
  }
  if (stats.overdueTasks.length > 0) {
    return `${stats.overdueTasks.length} task${stats.overdueTasks.length === 1 ? ' is' : 's are'} past due. Pick the smallest one; the rest can wait their turn.`;
  }
  if (stats.todayProgress.completed === stats.todayProgress.total) {
    return 'Everything scheduled for today is complete. Stop here, or prepare tomorrow while it is still fresh.';
  }
  if (stats.todayFocusSessions === 0) {
    return 'No focus session yet today. One honest twenty-five-minute block would change the shape of the afternoon.';
  }
  if (stats.nextTask) {
    return `The next small step looks like “${stats.nextTask.title}”. One session is enough; you do not need to finish everything.`;
  }
  return 'A quiet day. Add a step only if it would genuinely help.';
}

export function DashboardPage() {
  const {
    state,
    stats,
    dispatch,
  } = useTakTic();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { openTask, openProject, openDecompose, openPlanner } = useAppActions();
  const [customising, setCustomising] = useState(false);

  const firstName = state.profile.displayName.split(/\s+/)[0] || 'there';
  const now = new Date();
  const today = todayKey();
  const note = useMemo(() => companionNote(stats), [stats]);
  const achievements = useMemo(
    () =>
      stats.unlockedAchievements
        .slice(0, 3)
        .map((unlock) => ({
          unlock,
          definition: ACHIEVEMENTS.find((achievement) => achievement.id === unlock.id),
        }))
        .filter((entry) => entry.definition),
    [stats.unlockedAchievements],
  );

  const widgetOrder = useMemo(() => {
    const stored = state.settings.dashboard.order;
    const missing = WIDGETS.map((widget) => widget.id).filter((id) => !stored.includes(id));
    return [...stored, ...missing];
  }, [state.settings.dashboard.order]);
  const hidden = state.settings.dashboard.hidden;
  const visibleWidgets = widgetOrder.filter((id) => !hidden.includes(id));

  const commitLayout = (order: DashboardWidgetId[], nextHidden: DashboardWidgetId[]) => {
    dispatch({
      type: 'UPDATE_SETTINGS',
      patch: {
        dashboard: { order, hidden: nextHidden, customized: true },
      },
    });
  };

  const moveWidget = (id: DashboardWidgetId, direction: -1 | 1) => {
    const index = widgetOrder.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= widgetOrder.length) return;
    const next = [...widgetOrder];
    [next[index], next[target]] = [next[target], next[index]];
    commitLayout(next, hidden);
  };

  const toggleHidden = (id: DashboardWidgetId) => {
    const nextHidden = hidden.includes(id)
      ? hidden.filter((item) => item !== id)
      : [...hidden, id];
    commitLayout(widgetOrder, nextHidden);
  };

  const restoreLayout = () => {
    const defaults = defaultSettings().dashboard;
    commitLayout(defaults.order, defaults.hidden);
  };

  const todayRoots = stats.todaysTasks.filter(
    (task) => !task.parentTaskId || !stats.todaysTasks.some((parent) => parent.id === task.parentTaskId),
  );
  const completedFocus = state.focusSessions.filter(
    (session) => session.type === 'focus' && session.status === 'completed',
  );
  const averageFocus =
    completedFocus.length > 0
      ? Math.round(
          completedFocus.reduce((sum, session) => sum + session.actualSeconds / 60, 0) /
            completedFocus.length,
        )
      : 0;
  const maxWeekFocus = Math.max(25, ...stats.weekDays.map((day) => day.focusMinutes));
  const objectivesDone = state.objectives.filter((objective) => objective.completed).length;

  const renderWidget = (id: DashboardWidgetId) => {
    switch (id) {
      case 'dailyProgress':
        return (
          <section className="flex h-full flex-col border border-line bg-paper p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Today&apos;s progress</p>
                <h2 className="mt-1 text-[20px]">Today&apos;s progress</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={openPlanner}>
                <CalendarRange size={12} aria-hidden />
                Plan
              </Button>
            </div>
            <div className="mt-5 flex items-end gap-4">
              <span className="font-mono text-[56px] leading-none tracking-[-0.05em] text-ink">
                {stats.todayProgress.percent}
                <span className="ml-0.5 text-[20px] text-muted">%</span>
              </span>
              <div className="pb-1">
                <p className="font-mono text-[13px] text-ink">
                  {stats.todayProgress.completed} / {stats.todayProgress.total} tasks completed
                </p>
                <p className="mt-0.5 text-[12px] text-muted">
                  {stats.todayProgress.hasTasks
                    ? `${stats.todayProgress.remaining} remaining today`
                    : 'No tasks scheduled today'}
                </p>
              </div>
            </div>
            <ProgressBar
              value={stats.todayProgress.percent}
              tone={stats.todayProgress.percent >= 100 ? 'sage' : 'accent'}
              height="lg"
              className="mt-4"
              label="Daily completion"
            />
            <p className="mt-3 text-[13px] leading-5 text-muted">
              {stats.todayProgress.total === 0
                ? 'Schedule a task for today to start measuring the day.'
                : stats.todayProgress.percent >= 100
                  ? 'Day complete. Nothing else is required.'
                  : 'Progress is counted from tasks actually scheduled or due today.'}
            </p>
            <div className="mt-auto grid grid-cols-3 gap-3 border-t border-line pt-4">
              <div>
                <p className="eyebrow mb-1">Focus</p>
                <p className="font-mono text-[15px] text-ink">{stats.todayFocusMinutes} min</p>
              </div>
              <div>
                <p className="eyebrow mb-1">Objectives</p>
                <p className="font-mono text-[15px] text-ink">{objectivesDone}/3</p>
              </div>
              <div>
                <p className="eyebrow mb-1">Overdue</p>
                <p className={cn('font-mono text-[15px]', stats.overdueTasks.length > 0 ? 'text-accent' : 'text-ink')}>
                  {stats.overdueTasks.length}
                </p>
              </div>
            </div>
          </section>
        );

      case 'progression':
        return (
          <section className="flex h-full flex-col border border-line bg-paper p-5 sm:p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow">Your progress</p>
                <h2 className="mt-1 text-[20px]">Your progress</h2>
              </div>
              <Link to="/statistics" className="text-[12px] text-muted underline decoration-line underline-offset-2 hover:text-ink">
                Statistics
              </Link>
            </div>
            <div className="mt-5 flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Level</p>
                <p className="font-mono text-[46px] leading-none tracking-[-0.04em] text-ink">
                  {String(stats.level.level).padStart(2, '0')}
                </p>
              </div>
              <div className="text-right">
                <p className="font-serif text-[14px] text-ink">{stats.level.title}</p>
                <p className="mt-1 font-mono text-[11px] text-muted">
                  {stats.level.intoLevel} / {stats.level.forNext} XP
                </p>
              </div>
            </div>
            <ProgressBar
              value={stats.level.percent}
              height="md"
              className="mt-3"
              label="Level progress"
            />
            <div className="mt-auto grid grid-cols-3 divide-x divide-line border-t border-line pt-4">
              <div className="pr-3">
                <p className="eyebrow mb-1 inline-flex items-center gap-1">
                  <Flame size={9} aria-hidden />
                  Streak
                </p>
                <p className="font-mono text-[16px] text-ink">{state.streak.currentStreak}d</p>
              </div>
              <div className="px-3">
                <p className="eyebrow mb-1">Longest</p>
                <p className="font-mono text-[16px] text-ink">{state.streak.longestStreak}d</p>
              </div>
              <div className="pl-3">
                <p className="eyebrow mb-1">Tasks</p>
                <p className="font-mono text-[16px] text-ink">{stats.completedTasksCount}</p>
              </div>
            </div>
            <p className="mt-3 text-[12px] leading-5 text-muted">
              {state.streak.currentStreak > 0
                ? `${state.streak.totalActiveDays} active days recorded. A missed day never removes XP.`
                : 'A new streak starts with one small action. Nothing is lost.'}
            </p>
          </section>
        );

      case 'todayTasks':
        return (
          <section className="flex h-full flex-col border border-line bg-paper">
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <p className="eyebrow">Today</p>
                <h2 className="mt-1 flex items-center gap-2 text-[20px]">
                  Today&apos;s tasks
                  <span className="font-mono text-[12px] text-muted">
                    {stats.todayProgress.completed}/{stats.todayProgress.total}
                  </span>
                </h2>
              </div>
              <Link
                to="/tasks?view=today"
                className="inline-flex items-center gap-1 text-[12px] text-muted underline decoration-line underline-offset-2 hover:text-ink"
              >
                All tasks
                <ArrowRight size={10} aria-hidden />
              </Link>
            </div>
            {todayRoots.length === 0 ? (
              <div className="flex flex-1 items-center p-4">
                <EmptyState
                  compact
                  icon={<CalendarRange size={17} aria-hidden />}
                  title="Your next step starts here."
                  description="Nothing is scheduled for today. Add one task, or open the planner to shape the day around what is already open."
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button size="sm" variant="primary" onClick={() => openTask()}>
                        New task
                      </Button>
                      <Button size="sm" variant="quiet" onClick={openPlanner}>
                        Plan my day
                      </Button>
                    </div>
                  }
                />
              </div>
            ) : (
              <div className="flex-1">
                {todayRoots.slice(0, 5).map((task) => (
                  <TaskRow key={task.id} task={task} compact showProject />
                ))}
                {todayRoots.length > 5 ? (
                  <Link
                    to="/tasks?view=today"
                    className="block px-5 py-2.5 text-[13px] text-muted transition-colors hover:text-ink"
                  >
                    + {todayRoots.length - 5} more scheduled
                  </Link>
                ) : null}
              </div>
            )}
            {stats.overdueTasks.length > 0 ? (
              <Link
                to="/tasks?view=overdue"
                className="flex items-center gap-2 border-t border-line px-5 py-2.5 text-[12px] text-accent transition-colors hover:bg-accent-soft/40"
              >
                <Clock3 size={11} aria-hidden />
                {stats.overdueTasks.length} overdue task
                {stats.overdueTasks.length === 1 ? '' : 's'} need a decision
                <ArrowRight size={10} className="ml-auto" aria-hidden />
              </Link>
            ) : null}
          </section>
        );

      case 'objectives':
        return (
          <section className="flex h-full flex-col border border-line bg-paper p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow">Today&apos;s goals</p>
                <h2 className="mt-1 text-[20px]">Three small targets</h2>
              </div>
              <Target size={15} className="text-muted" aria-hidden />
            </div>
            <ul className="mt-4 space-y-3">
              {state.objectives.map((objective) => {
                const done = objective.completed;
                const percent = Math.min(100, Math.round((objective.currentProgress / objective.target) * 100));
                return (
                  <li key={objective.id} className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        'mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center border',
                        done ? 'border-sage bg-sage text-paper' : 'border-line bg-paper',
                      )}
                      aria-hidden
                    >
                      {done ? <Check size={9} strokeWidth={3} /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-[14px] leading-5', done ? 'text-muted line-through decoration-muted/40' : 'text-ink')}>
                        {objective.description}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <ProgressBar
                          value={percent}
                          height="sm"
                          tone={done ? 'sage' : 'accent'}
                          className="flex-1"
                          label={objective.description}
                        />
                        <span className="shrink-0 font-mono text-[11px] text-muted">
                          {Math.min(objective.currentProgress, objective.target)}/{objective.target}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-auto border-t border-line pt-3 text-[12px] leading-5 text-muted">
              Each objective is worth {state.settings.xp.objective} XP. Progress comes from real
              completions, not check-ins.
            </p>
          </section>
        );

      case 'activeProjects': {
        const activeSummaries = stats.projectSummaries.filter(
          (summary) => summary.project.status === 'active',
        );
        return (
          <section className="flex h-full flex-col border border-line bg-paper">
            <div className="flex items-start justify-between gap-3 px-5 py-4">
              <div>
                <p className="eyebrow">Active projects</p>
                <h2 className="mt-1 text-[20px]">Active projects</h2>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => openProject()} className="text-[12px] text-muted hover:text-ink">
                  New
                </button>
                <Link to="/projects" className="text-[12px] text-muted underline decoration-line underline-offset-2 hover:text-ink">
                  All
                </Link>
              </div>
            </div>
            {activeSummaries.length === 0 ? (
              <div className="flex flex-1 items-center p-4">
                <EmptyState
                  compact
                  icon={<FolderOpen size={17} aria-hidden />}
                  title="Nothing on the board yet."
                  description="Start with something you have been putting off. A project can be broad; the steps will become smaller."
                  action={
                    <Button size="sm" variant="primary" onClick={() => openProject()}>
                      Create a project
                    </Button>
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {activeSummaries.slice(0, 4).map(({ project, progress }) => {
                  const info = project.deadline ? deadlineInfo(project.deadline, false, false) : null;
                  return (
                    <li key={project.id}>
                      <Link
                        to={`/projects/${project.id}`}
                        className="block px-5 py-3 transition-colors hover:bg-surface2/35"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-[14px] text-ink">{project.title}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2.5">
                              <PriorityBadge priority={project.priority} />
                              <span className="font-mono text-[11px] text-muted">
                                {progress.completed}/{progress.total} tasks
                              </span>
                              {info ? (
                                <span
                                  className={cn(
                                    'font-mono text-[11px]',
                                    info.tone === 'overdue' ? 'text-accent' : 'text-muted',
                                  )}
                                >
                                  {info.label}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <span className="shrink-0 font-mono text-[16px] text-ink">
                            {progress.percent}%
                          </span>
                        </div>
                        <ProgressBar
                          value={progress.percent}
                          height="sm"
                          className="mt-2.5"
                          label={`${project.title} progress`}
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            {activeSummaries.length > 4 ? (
              <Link to="/projects" className="border-t border-line px-5 py-2 text-[12px] text-muted hover:text-ink">
                {activeSummaries.length - 4} more active projects
              </Link>
            ) : null}
          </section>
        );
      }

      case 'deadlines':
        return (
          <section className="flex h-full flex-col border border-line bg-paper p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow">Upcoming deadlines</p>
                <h2 className="mt-1 text-[20px]">Coming up</h2>
              </div>
              <Link to="/calendar" className="text-[12px] text-muted underline decoration-line underline-offset-2 hover:text-ink">
                Calendar
              </Link>
            </div>
            {stats.upcomingDeadlines.length === 0 ? (
              <div className="mt-4 flex-1">
                <EmptyState
                  compact
                  icon={<Clock3 size={16} aria-hidden />}
                  title="No deadlines set."
                  description="Deadlines are optional. Add one when a date actually matters."
                />
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-line border-t border-line">
                {stats.upcomingDeadlines.map((task) => {
                  const info = deadlineInfo(task.deadline, task.deadlineHasTime, false);
                  return (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => openTask({ taskId: task.id })}
                        className="flex w-full items-start justify-between gap-3 py-2.5 text-left transition-colors hover:text-accent"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] text-ink">{task.title}</span>
                          <span className="mt-0.5 block font-mono text-[11px] text-muted">
                            {formatDuration(task.estimatedMinutes)} · {task.priority}
                          </span>
                        </span>
                        <span
                          className={cn(
                            'shrink-0 pt-0.5 font-mono text-[11px]',
                            info.tone === 'soon' || info.tone === 'overdue' ? 'text-accent' : 'text-muted',
                          )}
                        >
                          {info.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );

      case 'focusStats':
        return (
          <section className="flex h-full flex-col border border-line bg-paper p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow">Focus timer</p>
                <h2 className="mt-1 text-[20px]">Focus timer</h2>
              </div>
              <Timer size={15} className="text-muted" aria-hidden />
            </div>
            <div className="mt-4 flex items-end gap-4">
              <span className="font-mono text-[36px] leading-none tracking-[-0.04em] text-ink">
                {stats.todayFocusMinutes}
                <span className="ml-1 text-[13px] text-muted">min</span>
              </span>
              <span className="pb-1 font-mono text-[12px] text-muted">
                {stats.todayFocusSessions} sessions today
              </span>
            </div>
            <div className="mt-4 flex items-end justify-between gap-1.5" aria-hidden>
              {stats.weekDays.map((day) => {
                const height = Math.max(2, Math.round((day.focusMinutes / maxWeekFocus) * 44));
                const isToday = day.date === today;
                return (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={cn('w-full', day.focusMinutes > 0 ? 'bg-accent/75' : 'bg-stone/60')}
                      style={{ height }}
                    />
                    <span className={cn('font-mono text-[10px]', isToday ? 'text-accent' : 'text-muted')}>
                      {formatDateKey(day.date, { weekday: 'narrow' })}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
              <p className="font-mono text-[11px] text-muted">
                {stats.weekFocusMinutes} min this week · avg {averageFocus} min
              </p>
              <Link to="/focus" className="text-[12px] text-muted underline decoration-line underline-offset-2 hover:text-ink">
                Open
              </Link>
            </div>
          </section>
        );

      case 'recentAchievements':
        return (
          <section className="flex h-full flex-col border border-line bg-paper p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow">Achievements</p>
                <h2 className="mt-1 text-[20px]">Recent marks</h2>
              </div>
              <Trophy size={15} className="text-muted" aria-hidden />
            </div>
            {achievements.length === 0 ? (
              <div className="mt-4 flex-1">
                <EmptyState
                  compact
                  icon={<Trophy size={16} aria-hidden />}
                  title="Your collection is just getting started."
                  description="Complete a task or a focus session to open the first mark."
                  action={
                    <Link to="/achievements" className="text-[13px] text-accent underline decoration-accent/40 underline-offset-2">
                      View all
                    </Link>
                  }
                />
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {achievements.map(({ unlock, definition }) =>
                  definition ? (
                    <li key={unlock.id} className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-line text-accent">
                        <AchievementIcon name={definition.icon} size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] text-ink">{definition.name}</p>
                        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                          {humanRelative(unlock.unlockedAt)} · +{definition.xpReward} XP
                        </p>
                      </div>
                    </li>
                  ) : null,
                )}
              </ul>
            )}
            <Link
              to="/achievements"
              className="mt-auto border-t border-line pt-3 text-[12px] text-muted underline decoration-line underline-offset-2 hover:text-ink"
            >
              {stats.unlockedAchievements.length} of {ACHIEVEMENTS.length} unlocked
            </Link>
          </section>
        );

      case 'companionNote':
        return (
          <section className="flex h-full flex-col border border-line bg-paper p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow">AI note</p>
                <h2 className="mt-1 text-[20px]">One observation</h2>
              </div>
              <MessageCircle size={15} className="text-muted" aria-hidden />
            </div>
            <p className="mt-4 text-[14px] leading-6 text-ink/85">{note}</p>
            {stats.nextTask ? (
              <div className="mt-3 border-l-2 border-accent/50 pl-3">
                <p className="eyebrow mb-0.5">Next step</p>
                <p className="text-[13px] leading-5 text-ink/80">{stats.nextTask.title}</p>
              </div>
            ) : null}
            <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                from your workspace
              </span>
              <Link to="/companion" className="text-[12px] text-accent underline decoration-accent/40 underline-offset-2">
                Talk it through
              </Link>
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  return (
    <div>
      <section className="mb-6 overflow-hidden border border-line bg-paper shadow-paper">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-7">
          <div className="min-w-0">
            <p className="eyebrow">Dashboard</p>
            <h1 className="mt-2 text-balance text-[34px] leading-[1.1] sm:text-[44px]">
              {greetingForHour(now.getHours())}, {firstName}.
            </h1>
            <p className="mt-2 text-[15px] leading-6 text-muted">
              {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              {' · '}One step at a time.
            </p>
          </div>
          <div className="flex shrink-0 items-end gap-4 self-start rounded-[12px] border border-line bg-ivory/60 px-4 py-3 sm:self-auto">
            <div className="text-right">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Today</p>
              <p className="font-serif text-[40px] leading-none tracking-[-0.04em] text-ink">
                {formatDateKey(today, { day: 'numeric' })}
              </p>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                {formatDateKey(today, { month: 'long' })} {now.getFullYear()}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-ivory/40 px-6 py-4 sm:px-7">
          <Button variant="primary" onClick={() => openTask()}>
            <Plus size={14} aria-hidden />
            New task
          </Button>
          <Button variant="secondary" onClick={() => openProject()}>
            <FolderOpen size={13} aria-hidden />
            New project
          </Button>
          <Button variant="ghost" onClick={() => navigate('/focus')}>
            <Timer size={13} aria-hidden />
            Focus timer
          </Button>
          <Button variant="ghost" onClick={openPlanner}>
            <CalendarRange size={13} aria-hidden />
            Plan my day
          </Button>
          <Button variant="ghost" onClick={() => navigate('/companion')}>
            <MessageCircle size={13} aria-hidden />
            Ask AI
          </Button>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="eyebrow">Dashboard</span>
          <span className="h-px w-6 bg-line" aria-hidden />
          <span className="font-mono text-[11px] text-muted">
            {visibleWidgets.length} of {WIDGETS.length} panels
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => openDecompose()}>
            <Wand2 size={12} aria-hidden />
            Split a big task
          </Button>
          <Button
            variant={customising ? 'primary' : 'quiet'}
            size="sm"
            onClick={() => setCustomising((current) => !current)}
            aria-expanded={customising}
          >
            <SlidersHorizontal size={12} aria-hidden />
            Arrange
          </Button>
        </div>
      </div>

      {customising ? (
        <section className="mb-4 border border-line bg-paper">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <p className="eyebrow">Dashboard layout</p>
              <p className="mt-0.5 text-[13px] text-muted">
                Move panels up or down, hide what you do not need. Nothing else changes.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={restoreLayout}>
              <RotateCcw size={12} aria-hidden />
              Restore default
            </Button>
          </div>
          <ul className="divide-y divide-line">
            {widgetOrder.map((id, index) => {
              const widget = WIDGETS.find((item) => item.id === id);
              if (!widget) return null;
              const isHidden = hidden.includes(id);
              return (
                <li key={id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="w-5 font-mono text-[11px] text-muted">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-[14px]', isHidden ? 'text-muted' : 'text-ink')}>
                      {widget.label}
                    </span>
                    <span className="block text-[12px] text-muted">{widget.description}</span>
                  </span>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      aria-label={`Move ${widget.label} up`}
                      onClick={() => moveWidget(id, -1)}
                      disabled={index === 0}
                      className="flex h-7 w-7 items-center justify-center text-muted transition-colors hover:text-ink disabled:opacity-30"
                    >
                      <ArrowUp size={13} aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${widget.label} down`}
                      onClick={() => moveWidget(id, 1)}
                      disabled={index === widgetOrder.length - 1}
                      className="flex h-7 w-7 items-center justify-center text-muted transition-colors hover:text-ink disabled:opacity-30"
                    >
                      <ArrowDown size={13} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleHidden(id)}
                      className="ml-1 inline-flex items-center gap-1 border border-line px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted transition-colors hover:text-ink"
                      aria-label={isHidden ? `Show ${widget.label}` : `Hide ${widget.label}`}
                    >
                      {isHidden ? <Eye size={11} aria-hidden /> : <EyeOff size={11} aria-hidden />}
                      {isHidden ? 'Show' : 'Hide'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {state.projects.length === 0 && state.tasks.length === 0 && !state.demoLoaded ? (
        <section className="mb-4 flex flex-col gap-4 border border-line bg-paper p-5 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="eyebrow">Nothing here yet</p>
            <h2 className="mt-1 text-[24px]">Nothing planned yet.</h2>
            <p className="mt-1 text-[15px] leading-7 text-muted">
              Add a task or create a project to get started.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => openTask()}>
              Add a task
            </Button>
            <Button variant="secondary" onClick={() => openProject()}>
              Create a project
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                dispatch({ type: 'LOAD_DEMO' });
                toast({ title: 'Demo workspace loaded', description: 'Four projects and several weeks of history.', tone: 'success' });
              }}
            >
              Try demo workspace
            </Button>
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        {visibleWidgets.map((id) => (
          <div key={id} className={SPANS[id]}>
            {renderWidget(id)}
          </div>
        ))}
      </div>

      {visibleWidgets.length === 0 ? (
        <EmptyState
          eyebrow="All panels hidden"
          title="The desk is clear."
          description="Every dashboard panel is hidden. Restore the default layout when you want them back."
          action={
            <Button variant="primary" onClick={restoreLayout}>
              Restore default layout
            </Button>
          }
        />
      ) : null}

      <div className="mt-8 hidden items-center justify-between border-t border-line pt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted lg:flex">
        <span>{formatDateKey(today, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <Link to="/statistics" className="inline-flex items-center gap-1 hover:text-ink">
          <CheckCircle2 size={10} aria-hidden />
          Progress is calculated from real tasks
        </Link>
        <span className={buttonClass('ghost', 'sm', 'pointer-events-none h-auto border-0 p-0 text-[10px]')}>
          <Target size={10} aria-hidden />
          One step at a time
        </span>
      </div>
    </div>
  );
}
