import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock3, Flame, Timer, TrendingUp } from 'lucide-react';
import { useTakTic } from '../store/TakTicProvider';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/Feedback';
import { StatusPill } from '../components/ui/Badges';
import {
  addDays,
  formatDateKey,
  formatDuration,
  formatTime,
  toDateKey,
  todayKey,
} from '../utils/date';
import { focusMinutesOn, leafTasks } from '../utils/tasks';
import { cn } from '../utils/cn';

export function StatisticsPage() {
  const { state, stats } = useTakTic();
  const today = todayKey();

  const completedLeaves = useMemo(
    () => leafTasks(state.tasks).filter((task) => task.status === 'completed'),
    [state.tasks],
  );

  const focusSessions = useMemo(
    () =>
      state.focusSessions.filter(
        (session) => session.type === 'focus' && session.status === 'completed',
      ),
    [state.focusSessions],
  );

  const averageSession = useMemo(() => {
    if (focusSessions.length === 0) return 0;
    return Math.round(
      focusSessions.reduce((sum, session) => sum + session.actualSeconds / 60, 0) /
        focusSessions.length,
    );
  }, [focusSessions]);

  const days = useMemo(() => {
    const all = Array.from({ length: 14 }, (_, index) => addDays(today, index - 13));
    return all.map((key) => {
      const completed = completedLeaves.filter(
        (task) => task.completedAt && toDateKey(task.completedAt) === key,
      ).length;
      return {
        key,
        completed,
        focusMinutes: focusMinutesOn(state, key),
      };
    });
  }, [completedLeaves, state, today]);

  const lastSeven = days.slice(-7);
  const priorSeven = days.slice(0, 7);
  const tasksThisWeek = lastSeven.reduce((sum, day) => sum + day.completed, 0);
  const focusThisWeek = lastSeven.reduce((sum, day) => sum + day.focusMinutes, 0);
  const tasksPrior = priorSeven.reduce((sum, day) => sum + day.completed, 0);
  const focusPrior = priorSeven.reduce((sum, day) => sum + day.focusMinutes, 0);
  const maxCompleted = Math.max(1, ...lastSeven.map((day) => day.completed));
  const maxFocus = Math.max(5, ...days.map((day) => day.focusMinutes));

  const lastSevenKeys = new Set(lastSeven.map((day) => day.key));
  const completedThisWeek = completedLeaves.filter(
    (task) => task.completedAt && lastSevenKeys.has(toDateKey(task.completedAt)),
  );
  const projectsTouched = new Set(completedThisWeek.map((task) => task.projectId)).size;
  const shortTasks = completedThisWeek.filter((task) => task.estimatedMinutes <= 20).length;
  const taskDifference = Math.abs(tasksThisWeek - tasksPrior);
  const focusDifference = Math.abs(focusThisWeek - focusPrior);

  const timedTasks = completedLeaves
    .filter((task) => task.actualMinutes > 0 && task.estimatedMinutes > 0)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    .slice(0, 6);

  const focusHistory = [...focusSessions]
    .sort((a, b) => b.startTime.localeCompare(a.startTime))
    .slice(0, 8);

  const accuracyLabel =
    stats.estimateAccuracy.samples === 0
      ? 'No timed tasks yet'
      : stats.estimateAccuracy.direction === 'balanced'
        ? 'Well calibrated'
        : stats.estimateAccuracy.direction === 'under'
          ? `≈${stats.estimateAccuracy.averageDeviation}% under`
          : `≈${stats.estimateAccuracy.averageDeviation}% over`;

  return (
    <div>
      <PageHeader
        index="07"
        jp=""
        title="Statistics"
        description="A factual record of what you actually did. No comparisons with other people, and no invented trends."
        actions={
          <Link
            to="/achievements"
            className="inline-flex items-center gap-1.5 border border-line px-3 py-2 text-[13px] text-muted hover:text-ink"
          >
            Achievements
            <ArrowRight size={12} aria-hidden />
          </Link>
        }
      />

      <div className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Tasks completed', value: String(stats.completedTasksCount), note: 'actionable steps only' },
          { label: 'Focus time', value: formatDuration(stats.totalFocusMinutes), note: 'all qualifying sessions' },
          { label: 'XP earned', value: String(state.profile.xp), note: 'from the transaction ledger' },
          { label: 'Projects completed', value: String(stats.completedProjectsCount), note: 'counted once each' },
        ].map((item) => (
          <div key={item.label} className="bg-paper px-4 py-4">
            <p className="eyebrow mb-1.5">{item.label}</p>
            <p className="font-mono text-[22px] leading-none text-ink">{item.value}</p>
            <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
              {item.note}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Level', value: `Lv ${stats.level.level}`, note: stats.level.title },
          { label: 'Current streak', value: `${state.streak.currentStreak} days`, note: 'grace if today is quiet' },
          { label: 'Longest streak', value: `${state.streak.longestStreak} days`, note: `${state.streak.totalActiveDays} active days` },
          { label: 'Average session', value: `${averageSession} min`, note: `${focusSessions.length} completed sessions` },
        ].map((item) => (
          <div key={item.label} className="bg-paper px-4 py-3">
            <p className="eyebrow mb-1">{item.label}</p>
            <p className="font-mono text-[15px] text-ink">{item.value}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted">{item.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <ChartCard
          eyebrow="Task completion"
          title="Last seven days"
          aside={`${tasksThisWeek} completed`}
        >
          <div className="flex h-[150px] items-end gap-2 border-b border-line pb-2">
            {lastSeven.map((day) => {
              const height = Math.max(2, (day.completed / maxCompleted) * 112);
              const isToday = day.key === today;
              return (
                <div key={day.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="font-mono text-[10px] text-muted">
                    {day.completed > 0 ? day.completed : ''}
                  </span>
                  <div
                    className={cn(
                      'w-full max-w-[30px] transition-colors',
                      day.completed === 0 ? 'bg-stone/60' : isToday ? 'bg-accent' : 'bg-accent/55',
                    )}
                    style={{ height }}
                    title={`${day.completed} tasks on ${formatDateKey(day.key, { weekday: 'long', day: 'numeric', month: 'short' })}`}
                  />
                  <span
                    className={cn(
                      'font-mono text-[10px] uppercase tracking-[0.05em]',
                      isToday ? 'text-accent' : 'text-muted',
                    )}
                  >
                    {formatDateKey(day.key, { weekday: 'narrow' })}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[12px] leading-5 text-muted">
            Counts leaf tasks completed on each local calendar day. Reopening a task does not erase
            the record.
          </p>
        </ChartCard>

        <ChartCard
          eyebrow="Focus"
          title="Fourteen-day rhythm"
          aside={`${focusThisWeek} min · last 7 days`}
        >
          <div className="flex h-[150px] items-end gap-[3px] border-b border-line pb-2">
            {days.map((day) => {
              const height = Math.max(2, (day.focusMinutes / maxFocus) * 112);
              return (
                <div key={day.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <div
                    className={cn(
                      'w-full',
                      day.focusMinutes === 0 ? 'bg-stone/50' : 'bg-sage/70',
                      day.key === today && 'bg-sage',
                    )}
                    style={{ height }}
                    title={`${day.focusMinutes} focus minutes on ${formatDateKey(day.key, { day: 'numeric', month: 'short' })}`}
                  />
                  {day.key === today || day === days[0] || day === days[6] ? (
                    <span className="font-mono text-[10px] text-muted">
                      {formatDateKey(day.key, { day: 'numeric' })}
                    </span>
                  ) : (
                    <span className="h-[9px]" aria-hidden />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-muted">
            <span>{days[0] ? formatDateKey(days[0].key, { day: 'numeric', month: 'short' }) : ''}</span>
            <span>{stats.weekFocusMinutes} min this calendar week</span>
            <span>{formatDateKey(today, { day: 'numeric', month: 'short' })}</span>
          </div>
        </ChartCard>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="border border-line bg-paper">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <p className="eyebrow">Estimates vs reality</p>
              <h2 className="mt-0.5 text-[16px]">How long things actually took</h2>
            </div>
            <span
              className={cn(
                'border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em]',
                stats.estimateAccuracy.samples === 0
                  ? 'border-line text-muted'
                  : stats.estimateAccuracy.direction === 'balanced'
                    ? 'border-sage/50 text-sage'
                    : 'border-accent/40 text-accent',
              )}
            >
              {stats.estimateAccuracy.samples} timed tasks · {accuracyLabel}
            </span>
          </div>
          {timedTasks.length === 0 ? (
            <div className="p-4">
              <EmptyState
                compact
                icon={<Clock3 size={16} aria-hidden />}
                title="No completed tasks with recorded time yet."
                description="Focus sessions add actual minutes to their task. Complete a few and estimates will have something to compare against."
              />
            </div>
          ) : (
            <div className="divide-y divide-line">
              {timedTasks.map((task) => {
                const max = Math.max(task.estimatedMinutes, task.actualMinutes, 1);
                const difference = task.actualMinutes - task.estimatedMinutes;
                return (
                  <div key={task.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-[13px] text-ink">{task.title}</p>
                      <span
                        className={cn(
                          'font-mono text-[11px]',
                          Math.abs(difference) <= 5
                            ? 'text-sage'
                            : difference > 0
                              ? 'text-accent'
                              : 'text-muted',
                        )}
                      >
                        {difference > 0 ? '+' : ''}
                        {difference} min
                      </span>
                    </div>
                    <div className="mt-1.5 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-8 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">est</span>
                        <div className="h-1.5 flex-1 bg-stone/50">
                          <div className="h-full bg-muted/50" style={{ width: `${(task.estimatedMinutes / max) * 100}%` }} />
                        </div>
                        <span className="w-12 text-right font-mono text-[10px] text-muted">
                          {task.estimatedMinutes}m
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-8 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">act</span>
                        <div className="h-1.5 flex-1 bg-stone/50">
                          <div className="h-full bg-accent/75" style={{ width: `${(task.actualMinutes / max) * 100}%` }} />
                        </div>
                        <span className="w-12 text-right font-mono text-[10px] text-ink/70">
                          {task.actualMinutes}m
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="border-t border-line px-4 py-2.5 text-[12px] leading-5 text-muted">
            Estimates inform future planning. TakTic does not assume every task should become
            easier — only more accurately estimated.
          </p>
        </section>

        <section className="border border-line bg-paper p-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-accent" aria-hidden />
            <div>
              <p className="eyebrow">Your patterns</p>
              <h2 className="mt-0.5 text-[15px]">Read from real data</h2>
            </div>
          </div>
          <ul className="mt-3 space-y-3 text-[13px] leading-5">
            <li className="border-b border-line pb-2.5">
              <p className="text-ink">You completed {tasksThisWeek} task{tasksThisWeek === 1 ? '' : 's'} in the last seven days.</p>
              <p className="text-muted">
                {tasksPrior === 0
                  ? tasksThisWeek > 0
                    ? 'The previous seven days had no recorded completions.'
                    : 'No completions are recorded in either seven-day window yet.'
                  : taskDifference === 0
                    ? 'The same number as the previous seven days.'
                    : `${taskDifference} ${tasksThisWeek > tasksPrior ? 'more' : 'fewer'} than the previous seven days.`}
              </p>
            </li>
            <li className="border-b border-line pb-2.5">
              <p className="text-ink">
                {focusThisWeek > 0
                  ? `You recorded ${focusThisWeek} focus minutes in the last seven days.`
                  : 'No focus minutes are recorded in the last seven days.'}
              </p>
              <p className="text-muted">
                {focusPrior === 0
                  ? focusThisWeek > 0
                    ? 'The previous seven days had no focus sessions.'
                    : 'Complete a qualifying focus session to start this comparison.'
                  : focusDifference === 0
                    ? 'The same as the previous seven days.'
                    : `${focusDifference} min ${focusThisWeek > focusPrior ? 'more' : 'less'} than the previous seven days.`}
              </p>
            </li>
            <li className="border-b border-line pb-2.5">
              <p className="text-ink">
                {projectsTouched > 0
                  ? `You completed work across ${projectsTouched} project${projectsTouched === 1 ? '' : 's'} this week.`
                  : 'No project has recorded completed work this week.'}
              </p>
              <p className="text-muted">
                {completedThisWeek.length > 0
                  ? `${shortTasks} of ${completedThisWeek.length} completed step${completedThisWeek.length === 1 ? '' : 's'} were planned for 20 minutes or less.`
                  : 'Project and task-length patterns appear after a completion.'}
              </p>
            </li>
            <li>
              <p className="text-ink">
                {stats.estimateAccuracy.samples === 0
                  ? 'Estimate accuracy will appear after a few timed tasks.'
                  : stats.estimateAccuracy.direction === 'balanced'
                    ? `Your estimates are within ${stats.estimateAccuracy.averageDeviation}% across ${stats.estimateAccuracy.samples} tasks.`
                    : stats.estimateAccuracy.direction === 'under'
                      ? `Your estimates ran about ${stats.estimateAccuracy.averageDeviation}% shorter than the recorded time.`
                      : `Your estimates ran about ${stats.estimateAccuracy.averageDeviation}% longer than the recorded time.`}
              </p>
              <p className="text-muted">Based only on tasks with recorded actual minutes.</p>
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-3 border-t border-line pt-3 font-mono text-[11px] text-muted">
            <span className="inline-flex items-center gap-1">
              <Flame size={10} aria-hidden /> {state.streak.longestStreak}d longest
            </span>
            <span className="inline-flex items-center gap-1">
              <Timer size={10} aria-hidden /> {state.streak.totalActiveDays} active days
            </span>
          </div>
        </section>
      </div>

      <section className="mt-5 border border-line bg-paper">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <p className="eyebrow">Session history</p>
            <h2 className="mt-0.5 text-[16px]">Recent focus sessions</h2>
          </div>
          <Link to="/focus" className="text-[12px] text-muted underline decoration-line underline-offset-2 hover:text-ink">
            Open focus room
          </Link>
        </div>
        {focusHistory.length === 0 ? (
          <div className="p-4">
            <EmptyState
              compact
              icon={<Timer size={16} aria-hidden />}
              title="Your first focus session is waiting."
              description="Sessions appear here with planned and actual time, so you can compare."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  {['Date', 'Task', 'Planned', 'Actual', 'Status', 'XP'].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {focusHistory.map((session) => {
                  const task = state.tasks.find((candidate) => candidate.id === session.taskId);
                  const xp = state.xpTransactions.some(
                    (transaction) => transaction.source === `focus:${session.id}`,
                  );
                  return (
                    <tr key={session.id} className="border-b border-line/70 last:border-b-0">
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] text-muted">
                        {formatDateKey(toDateKey(session.startTime), {
                          day: 'numeric',
                          month: 'short',
                        })}{' '}
                        {formatTime(session.startTime)}
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-2.5 text-[13px] text-ink">
                        {task?.title ?? 'Unattached focus'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-muted">
                        {Math.round(session.plannedSeconds / 60)}m
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-ink">
                        {Math.round(session.actualSeconds / 60)}m
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusPill tone={session.status === 'completed' ? 'sage' : 'neutral'}>
                          {session.status === 'completed' ? 'complete' : 'ended'}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-muted">
                        {xp ? `+${state.settings.xp.focus}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-5 border-t border-line pt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
        Every figure derives from local task, session and XP records · no benchmarks
      </p>
    </div>
  );
}

function ChartCard({
  eyebrow,
  title,
  aside,
  children,
}: {
  eyebrow: string;
  title: string;
  aside: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-line bg-paper p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="mt-0.5 text-[16px]">{title}</h2>
        </div>
        <span className="font-mono text-[11px] text-muted">{aside}</span>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
