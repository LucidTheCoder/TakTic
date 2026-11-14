import { useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
} from 'lucide-react';
import type { DailyPlan, FocusSession } from '../types';
import { useTakTic } from '../store/TakTicProvider';
import { useAppActions } from '../components/app/AppActionsProvider';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Segmented } from '../components/ui/Tabs';
import { DeadlineLabel, PriorityBadge, StatusPill } from '../components/ui/Badges';
import {
  addDays,
  deadlineInfo,
  formatDateKey,
  formatTime,
  fromDateKey,
  monthMatrix,
  todayKey,
  toDateKey,
  weekKeys,
} from '../utils/date';
import { focusMinutesOn, tasksForDate } from '../utils/tasks';
import { cn } from '../utils/cn';
import type { Task } from '../types';

type View = 'month' | 'week' | 'day';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function shiftMonthKey(key: string, delta: number): string {
  const date = fromDateKey(key);
  const target = new Date(date.getFullYear(), date.getMonth() + delta, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return toDateKey(target);
}

export function CalendarPage() {
  const { state } = useTakTic();
  const { openTask, openPlanner } = useAppActions();
  const [view, setView] = useState<View>('month');
  const [selected, setSelected] = useState(todayKey());
  const today = todayKey();
  const selectedDate = fromDateKey(selected);

  const dayTasks = useMemo(() => tasksForDate(state.tasks, selected), [state.tasks, selected]);
  const dayCompleted = useMemo(
    () =>
      state.tasks.filter(
        (task) =>
          task.status === 'completed' &&
          task.completedAt &&
          toDateKey(task.completedAt) === selected &&
          task.childTaskIds.length === 0,
      ),
    [state.tasks, selected],
  );
  const daySessions = useMemo(
    () =>
      state.focusSessions
        .filter((session) => toDateKey(session.startTime) === selected)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [state.focusSessions, selected],
  );
  const dayDeadlines = dayTasks.filter(
    (task) => task.deadline && toDateKey(task.deadline) === selected,
  );
  const savedPlan = state.dailyPlans.find((plan) => plan.date === selected);

  const monthKeys = useMemo(() => {
    const keys = monthMatrix(selectedDate.getFullYear(), selectedDate.getMonth());
    const lastWeek = keys.slice(35, 42);
    const sameMonth = lastWeek.some(
      (key) =>
        fromDateKey(key).getMonth() === selectedDate.getMonth() &&
        fromDateKey(key).getFullYear() === selectedDate.getFullYear(),
    );
    return sameMonth ? keys : keys.slice(0, 35);
  }, [selectedDate]);

  const monthLabel = new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(selectedDate);

  const daysForView = view === 'week' ? weekKeys(selected) : [];

  const navigate = (direction: -1 | 1) => {
    if (view === 'month') setSelected(shiftMonthKey(selected, direction));
    else if (view === 'week') setSelected(addDays(selected, direction * 7));
    else setSelected(addDays(selected, direction));
  };

  const goToday = () => setSelected(today);

  const tasksForCell = (key: string) =>
    tasksForDate(state.tasks, key).filter((task) => task.status !== 'completed');

  const sessionsForCell = (key: string) =>
    state.focusSessions.filter(
      (session) => session.type === 'focus' && toDateKey(session.startTime) === key,
    );

  const renderCellTasks = (key: string, compact = false) => {
    const tasks = tasksForCell(key);
    const sessions = sessionsForCell(key);
    if (compact) {
      return (
        <div className="mt-1 flex items-center gap-1" aria-hidden>
          {tasks.slice(0, 3).map((task) => (
            <span
              key={task.id}
              className={cn(
                'h-1 w-1 rounded-full',
                task.priority === 'urgent' ? 'bg-accent' : task.priority === 'high' ? 'bg-accent/60' : 'bg-muted/60',
              )}
            />
          ))}
          {tasks.length > 3 ? (
            <span className="font-mono text-[10px] text-muted">+{tasks.length - 3}</span>
          ) : null}
          {sessions.length > 0 ? <span className="ml-0.5 h-1 w-2 bg-sage/70" /> : null}
        </div>
      );
    }
    return (
      <div className="mt-1 space-y-0.5">
        {tasks.slice(0, 2).map((task) => (
          <span
            key={task.id}
            className="flex items-center gap-1 truncate text-[10px] leading-4 text-ink/70"
          >
            <span
              className={cn(
                'h-1 w-1 shrink-0 rounded-full',
                task.priority === 'urgent' ? 'bg-accent' : 'bg-muted/60',
              )}
              aria-hidden
            />
            <span className="truncate">{task.title}</span>
          </span>
        ))}
        {tasks.length > 2 ? (
          <span className="block font-mono text-[10px] text-muted">+{tasks.length - 2}</span>
        ) : null}
        {sessions.length > 0 ? (
          <span className="block h-[2px] w-6 bg-sage/60" title={`${sessions.length} focus sessions`} />
        ) : null}
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        index="06"
        jp=""
        title="Calendar"
        description="Deadlines, scheduled tasks and focus sessions on a local calendar. Select a day to inspect it."
        actions={
          <>
            <Button variant="ghost" onClick={goToday}>
              Today
            </Button>
            {selected === today ? (
              <Button variant="secondary" onClick={openPlanner}>
                <CalendarDays size={13} aria-hidden />
                Plan today
              </Button>
            ) : null}
            <Button variant="primary" onClick={() => openTask()}>
              <Plus size={13} aria-hidden />
              New task
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-8 w-8 items-center justify-center border border-line bg-paper text-muted hover:text-ink"
            aria-label="Previous"
          >
            <ChevronLeft size={15} aria-hidden />
          </button>
          <h2 className="min-w-[180px] text-center text-[20px] sm:min-w-[220px]">
            {view === 'day' ? formatDateKey(selected, { weekday: 'long', day: 'numeric', month: 'long' }) : monthLabel}
          </h2>
          <button
            type="button"
            onClick={() => navigate(1)}
            className="flex h-8 w-8 items-center justify-center border border-line bg-paper text-muted hover:text-ink"
            aria-label="Next"
          >
            <ChevronRight size={15} aria-hidden />
          </button>
        </div>
        <Segmented
          value={view}
          onChange={setView}
          items={[
            { value: 'month', label: 'Month' },
            { value: 'week', label: 'Week' },
            { value: 'day', label: 'Day' },
          ]}
        />
      </div>

      {view === 'month' ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="border border-line bg-paper">
            <div className="grid grid-cols-7 border-b border-line bg-surface2/40">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="px-1 py-2 text-center">
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                    {label}
                  </span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthKeys.map((key) => {
                const date = fromDateKey(key);
                const isCurrentMonth = date.getMonth() === selectedDate.getMonth();
                const isToday = key === today;
                const isSelected = key === selected;
                const tasks = tasksForCell(key);
                const sessions = sessionsForCell(key);
                const activity = state.streak.activityDates.find((day) => day.date === key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelected(key)}
                    aria-label={`${formatDateKey(key, { weekday: 'long', day: 'numeric', month: 'long' })}${tasks.length ? `, ${tasks.length} tasks` : ''}`}
                    aria-pressed={isSelected}
                    className={cn(
                      'relative min-h-[64px] border-b border-r border-line p-1.5 text-left transition-colors last:border-r-0 sm:min-h-[92px] sm:p-2',
                      isSelected ? 'bg-accent-soft/50' : 'hover:bg-surface2/40',
                      !isCurrentMonth && 'opacity-40',
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <span
                        className={cn(
                          'flex h-5 w-5 items-center justify-center font-mono text-[12px]',
                          isToday ? 'bg-accent text-paper' : 'text-ink',
                        )}
                      >
                        {date.getDate()}
                      </span>
                      {activity ? (
                        <span
                          className="mt-1 h-1 w-1 rounded-full bg-sage"
                          title="Activity recorded"
                          aria-hidden
                        />
                      ) : null}
                    </div>
                    <div className="hidden sm:block">{renderCellTasks(key)}</div>
                    <div className="sm:hidden">{renderCellTasks(key, true)}</div>
                    {sessions.length > 0 ? (
                      <span className="absolute bottom-1 right-1.5 font-mono text-[10px] text-sage">
                        {sessions.reduce((sum, session) => sum + Math.round(session.actualSeconds / 60), 0)}m
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
              <span className="inline-flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-accent" aria-hidden /> priority
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-[2px] w-3 bg-sage/70" aria-hidden /> focus session
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-sage" aria-hidden /> active day
              </span>
            </div>
          </div>

          <DayAgenda
            selected={selected}
            tasks={dayTasks}
            deadlines={dayDeadlines}
            completed={dayCompleted}
            sessions={daySessions}
            savedPlan={savedPlan}
            onOpenTask={(id) => openTask({ taskId: id })}
            onAddTask={() => openTask()}
            isToday={selected === today}
          />
        </div>
      ) : view === 'week' ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="border border-line bg-paper">
            <div className="grid sm:grid-cols-7">
              {daysForView.map((key, index) => {
                const date = fromDateKey(key);
                const tasks = tasksForCell(key);
                const sessions = sessionsForCell(key);
                const isToday = key === today;
                const isSelected = key === selected;
                return (
                  <div key={key} className="border-b border-r border-line last:border-r-0 sm:min-h-[300px]">
                    <button
                      type="button"
                      onClick={() => setSelected(key)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 border-b border-line px-2 py-2 text-left',
                        isSelected ? 'bg-accent-soft/50' : 'hover:bg-surface2/40',
                      )}
                    >
                      <span className="flex items-baseline gap-1.5">
                        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                          {WEEKDAY_LABELS[index]}
                        </span>
                        <span
                          className={cn(
                            'flex h-5 w-5 items-center justify-center font-mono text-[12px]',
                            isToday ? 'bg-accent text-paper' : 'text-ink',
                          )}
                        >
                          {date.getDate()}
                        </span>
                      </span>
                      <span className="font-mono text-[10px] text-muted">
                        {sessions.length ? `${sessions.reduce((sum, s) => sum + Math.round(s.actualSeconds / 60), 0)}m` : ''}
                      </span>
                    </button>
                    <div className="space-y-1 p-1.5">
                      {tasks.length === 0 ? (
                        <p className="px-1 py-2 text-[11px] text-muted/70">—</p>
                      ) : (
                        tasks.map((task) => (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => openTask({ taskId: task.id })}
                            className="block w-full border border-line bg-paper px-1.5 py-1 text-left text-[11px] leading-4 text-ink/80 hover:border-accent/40"
                          >
                            <span className="line-clamp-2">{task.title}</span>
                            <span className="mt-0.5 flex items-center gap-1">
                              <span
                                className={cn(
                                  'h-1 w-1 rounded-full',
                                  task.priority === 'urgent' ? 'bg-accent' : 'bg-muted/60',
                                )}
                                aria-hidden
                              />
                              <span className="font-mono text-[10px] text-muted">
                                {task.estimatedMinutes}m
                              </span>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <DayAgenda
            selected={selected}
            tasks={dayTasks}
            deadlines={dayDeadlines}
            completed={dayCompleted}
            sessions={daySessions}
            savedPlan={savedPlan}
            onOpenTask={(id) => openTask({ taskId: id })}
            onAddTask={() => openTask()}
            isToday={selected === today}
          />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <DayAgenda
            selected={selected}
            tasks={dayTasks}
            deadlines={dayDeadlines}
            completed={dayCompleted}
            sessions={daySessions}
            savedPlan={savedPlan}
            onOpenTask={(id) => openTask({ taskId: id })}
            onAddTask={() => openTask()}
            isToday={selected === today}
            expanded
          />
          <div className="space-y-4">
            <section className="border border-line bg-paper p-4">
              <p className="eyebrow">Signals</p>
              <h2 className="mt-0.5 text-[15px]">This day</h2>
              <div className="mt-3 space-y-2 font-mono text-[12px] text-muted">
                <p className="flex justify-between">
                  <span>Focus minutes</span>
                  <span className="text-ink">{focusMinutesOn(state, selected)}</span>
                </p>
                <p className="flex justify-between">
                  <span>Finished tasks</span>
                  <span className="text-ink">{dayCompleted.length}</span>
                </p>
                <p className="flex justify-between">
                  <span>Open scheduled</span>
                  <span className="text-ink">
                    {dayTasks.filter((task) => task.status !== 'completed').length}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span>Focus sessions</span>
                  <span className="text-ink">
                    {daySessions.filter((session) => session.type === 'focus' && session.status === 'completed').length}
                  </span>
                </p>
              </div>
            </section>
            <UpcomingList
              tasks={state.tasks.filter((task) => task.status !== 'completed' && task.deadline)}
              onOpen={openTask}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function UpcomingList({ tasks, onOpen }: { tasks: Task[]; onOpen: (options: { taskId: string }) => void }) {
  const upcoming = [...tasks]
    .sort((a, b) => new Date(a.deadline as string).getTime() - new Date(b.deadline as string).getTime())
    .slice(0, 5);
  return (
    <section className="border border-line bg-paper p-4">
      <p className="eyebrow">Next deadlines</p>
      <h2 className="mt-0.5 text-[15px]">Coming up</h2>
      {upcoming.length === 0 ? (
        <p className="mt-2 text-[12px] leading-5 text-muted">No deadlines set on open tasks.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line border-t border-line">
          {upcoming.map((task) => {
            const info = deadlineInfo(task.deadline, task.deadlineHasTime, false);
            return (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => onOpen({ taskId: task.id })}
                  className="flex w-full items-start justify-between gap-2 py-2 text-left"
                >
                  <span className="min-w-0 truncate text-[12px] text-ink/85">{task.title}</span>
                  <span
                    className={cn(
                      'shrink-0 font-mono text-[10px]',
                      info.tone === 'overdue' ? 'text-accent' : 'text-muted',
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
}

function DayAgenda({
  selected,
  tasks,
  deadlines,
  completed,
  sessions,
  savedPlan,
  onOpenTask,
  onAddTask,
  isToday,
  expanded = false,
}: {
  selected: string;
  tasks: Task[];
  deadlines: Task[];
  completed: Task[];
  sessions: FocusSession[];
  savedPlan: DailyPlan | undefined;
  onOpenTask: (id: string) => void;
  onAddTask: () => void;
  isToday: boolean;
  expanded?: boolean;
}) {
  const { state: agendaState } = useTakTic();
  const open = tasks.filter((task) => task.status !== 'completed');
  const planned = savedPlan?.blocks ?? [];
  const focusMinutes = sessions
    .filter((session) => session.type === 'focus' && session.status === 'completed')
    .reduce((sum, session) => sum + Math.round(session.actualSeconds / 60), 0);

  return (
    <aside className={cn('border border-line bg-paper', !expanded && 'h-fit')}>
      <div className="border-b border-line px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="eyebrow">Agenda</p>
          {isToday ? (
            <span className="border border-accent/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-accent">
              Today
            </span>
          ) : null}
        </div>
        <h2 className="mt-1 text-[20px]">
          {formatDateKey(selected, { weekday: 'long', day: 'numeric' })}
        </h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
          {formatDateKey(selected, { month: 'long', year: 'numeric' })} · {focusMinutes} min focus
        </p>
      </div>

      <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
        {planned.length > 0 ? (
          <div className="border-b border-line px-4 py-3">
            <p className="eyebrow mb-2">Saved plan · {savedPlan?.source === 'ai' ? 'AI' : 'rules'}</p>
            <ul className="space-y-1">
              {planned.map((block) => (
                <li key={block.id} className="flex items-start gap-2 font-mono text-[11px]">
                  <span className="w-[78px] shrink-0 text-muted">{formatTime(block.start)}</span>
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate',
                      block.kind === 'focus' ? 'text-ink' : 'text-muted',
                    )}
                  >
                    {block.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow">Scheduled / due</p>
            <button
              type="button"
              onClick={onAddTask}
              className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted hover:text-ink"
            >
              <Plus size={9} aria-hidden /> Add
            </button>
          </div>
          {open.length === 0 && completed.length === 0 ? (
            <div className="border border-dashed border-line px-3 py-6 text-center">
              <p className="text-[13px] text-muted">Nothing recorded for this day.</p>
              <button
                type="button"
                onClick={onAddTask}
                className="mt-1.5 text-[12px] text-accent underline decoration-accent/40 underline-offset-2"
              >
                Add a task
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {open.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => onOpenTask(task.id)}
                    className="flex w-full items-start justify-between gap-2 py-2 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] leading-4 text-ink">{task.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-2">
                        <PriorityBadge priority={task.priority} />
                        <DeadlineLabel task={task} />
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-muted">
                      {task.estimatedMinutes}m
                    </span>
                  </button>
                </li>
              ))}
              {completed.map((task) => (
                <li key={task.id} className="flex items-center gap-2 py-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sage" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[12px] text-muted line-through decoration-muted/40">
                    {task.title}
                  </span>
                  <span className="font-mono text-[10px] text-sage">done</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {deadlines.length > 0 ? (
          <div className="border-t border-line px-4 py-3">
            <p className="eyebrow mb-2">Deadlines</p>
            <ul className="space-y-1">
              {deadlines.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenTask(task.id)}
                    className="min-w-0 truncate text-left text-[12px] text-ink/80"
                  >
                    {task.title}
                  </button>
                  <span className="shrink-0 font-mono text-[10px] text-accent">due</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {sessions.length > 0 ? (
          <div className="border-t border-line px-4 py-3">
            <p className="eyebrow mb-2">Focus sessions</p>
            <ul className="space-y-2">
              {sessions.map((session) => {
                const sessionTask = agendaState.tasks.find((candidate) => candidate.id === session.taskId);
                return (
                  <li key={session.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] text-ink/80">
                        {session.type === 'focus' ? sessionTask?.title ?? 'Focus block' : session.type === 'long' ? 'Long break' : 'Short break'}
                      </p>
                      <p className="font-mono text-[10px] text-muted">
                        {formatTime(session.startTime)} · {Math.round(session.actualSeconds / 60)} min
                      </p>
                    </div>
                    <StatusPill tone={session.status === 'completed' ? 'sage' : 'neutral'}>
                      {session.status === 'completed' ? 'done' : 'ended'}
                    </StatusPill>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div className="flex items-center gap-2 border-t border-line px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
          <Clock3 size={9} aria-hidden />
          {focusMinutes} minutes focused
          <span className="ml-auto">{completed.length} done</span>
        </div>
      </div>
    </aside>
  );
}

