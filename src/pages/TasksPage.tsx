import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarClock,
  Filter,
  LifeBuoy,
  ListChecks,
  Search,
  SlidersHorizontal,
  Wand2,
  X,
} from 'lucide-react';
import type { Difficulty, Priority, Task } from '../types';
import { useTakTic } from '../store/TakTicProvider';
import { useAppActions } from '../components/app/AppActionsProvider';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Form';
import { TabBar } from '../components/ui/Tabs';
import { EmptyState } from '../components/ui/Feedback';
import { TaskRow } from '../components/tasks/TaskRow';
import { cn } from '../utils/cn';
import {
  PRIORITY_ORDER,
  leafTasks,
  orderTasksByDependencies,
  projectProgress,
  projectTasks,
  tasksForDate,
} from '../utils/tasks';
import { isOverdue, todayKey, addDays, toDateKey } from '../utils/date';

type View = 'all' | 'today' | 'upcoming' | 'completed' | 'overdue' | 'byProject';
type SortKey = 'priority' | 'deadline' | 'duration' | 'created' | 'difficulty';
type DeadlineFilter = 'all' | 'overdue' | 'today' | 'week' | 'none';

const VIEWS: Array<{ value: View; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'completed', label: 'Finished' },
  { value: 'byProject', label: 'By project' },
];

function isView(value: string | null): value is View {
  return VIEWS.some((view) => view.value === value);
}

function withAncestors(tasks: Task[], matched: Task[]): Set<string> {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const ids = new Set(matched.map((task) => task.id));
  for (const task of matched) {
    let parentId = task.parentTaskId;
    while (parentId) {
      ids.add(parentId);
      parentId = byId.get(parentId)?.parentTaskId ?? null;
    }
  }
  return ids;
}

function compareTasks(a: Task, b: Task, sort: SortKey): number {
  switch (sort) {
    case 'deadline': {
      const aTime = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    }
    case 'duration':
      return a.estimatedMinutes - b.estimatedMinutes;
    case 'created':
      return b.createdAt.localeCompare(a.createdAt);
    case 'difficulty': {
      const order: Record<Difficulty, number> = { hard: 0, medium: 1, easy: 2 };
      return order[a.difficulty] - order[b.difficulty];
    }
    case 'priority':
    default:
      return (
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        (a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER) -
          (b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER)
      );
  }
}

export function TasksPage() {
  const { state, stats } = useTakTic();
  const { openTask, openDecompose, openPlanner, openCatchUp, openUnstuck } = useAppActions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<View>(() => {
    const fromUrl = searchParams.get('view');
    return isView(fromUrl) ? fromUrl : 'all';
  });
  const [query, setQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('');
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | ''>('');
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>('all');
  const [sort, setSort] = useState<SortKey>('priority');
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const fromUrl = searchParams.get('view');
    if (isView(fromUrl) && fromUrl !== view) setView(fromUrl);
    // The URL is the source only when it changes from outside this control.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const focusId = searchParams.get('focus');
    if (!focusId) return;
    if (state.tasks.some((task) => task.id === focusId)) {
      openTask({ taskId: focusId });
    }
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const changeView = (next: View) => {
    setView(next);
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('view');
    else params.set('view', next);
    setSearchParams(params, { replace: true });
  };

  const filtersActive =
    query.trim().length > 0 ||
    Boolean(projectFilter) ||
    Boolean(priorityFilter) ||
    Boolean(difficultyFilter) ||
    deadlineFilter !== 'all';

  const clearFilters = () => {
    setQuery('');
    setProjectFilter('');
    setPriorityFilter('');
    setDifficultyFilter('');
    setDeadlineFilter('all');
  };

  const activeFilterCount =
    (query.trim() ? 1 : 0) +
    (projectFilter ? 1 : 0) +
    (priorityFilter ? 1 : 0) +
    (difficultyFilter ? 1 : 0) +
    (deadlineFilter !== 'all' ? 1 : 0);

  const today = todayKey();
  const weekEnd = addDays(today, 7);

  const matched = useMemo(() => {
    const matchesFilters = (task: Task) => {
      const searchable = `${task.title} ${task.description}`.toLowerCase();
      if (query.trim() && !searchable.includes(query.trim().toLowerCase())) return false;
      if (projectFilter && task.projectId !== projectFilter) return false;
      if (priorityFilter && task.priority !== priorityFilter) return false;
      if (difficultyFilter && task.difficulty !== difficultyFilter) return false;
      if (deadlineFilter === 'none' && task.deadline) return false;
      if (deadlineFilter !== 'all' && deadlineFilter !== 'none') {
        if (!task.deadline) return false;
        const key = toDateKey(task.deadline);
        if (deadlineFilter === 'today' && key !== today) return false;
        if (deadlineFilter === 'overdue' && !isOverdue(task.deadline, task.deadlineHasTime, task.status === 'completed')) {
          return false;
        }
        if (deadlineFilter === 'week' && (key < today || key > weekEnd)) return false;
      }
      return true;
    };

    const leaves = leafTasks(state.tasks);
    let base: Task[] = [];
    switch (view) {
      case 'today':
        base = tasksForDate(state.tasks, today);
        break;
      case 'upcoming':
        base = state.tasks.filter((task) => {
          if (task.status === 'completed') return false;
          const scheduled = task.scheduledDate && task.scheduledDate > today;
          const deadline = task.deadline && toDateKey(task.deadline) > today;
          return Boolean(scheduled || deadline);
        });
        break;
      case 'completed':
        base = leaves.filter((task) => task.status === 'completed');
        break;
      case 'overdue':
        base = leaves.filter(
          (task) =>
            task.status !== 'completed' &&
            task.deadline !== null &&
            isOverdue(task.deadline, task.deadlineHasTime, false),
        );
        break;
      case 'all':
      case 'byProject':
      default:
        base = state.tasks;
        break;
    }
    return base.filter(matchesFilters);
  }, [
    state.tasks,
    view,
    today,
    weekEnd,
    query,
    projectFilter,
    priorityFilter,
    difficultyFilter,
    deadlineFilter,
  ]);

  const flatMode =
    view === 'completed' ||
    view === 'overdue' ||
    Boolean(query.trim()) ||
    Boolean(projectFilter) ||
    Boolean(priorityFilter) ||
    Boolean(difficultyFilter) ||
    deadlineFilter !== 'all';

  const visibleIds = useMemo(
    () => (flatMode ? new Set(matched.map((task) => task.id)) : withAncestors(state.tasks, matched)),
    [matched, state.tasks, flatMode],
  );

  const sortedMatched = useMemo(
    () =>
      orderTasksByDependencies([...matched], state.tasks, (a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (b.status === 'completed' && a.status !== 'completed') return -1;
        return compareTasks(a, b, sort);
      }),
    [matched, sort, state.tasks],
  );

  const roots = useMemo(
    () =>
      sortedMatched.filter(
        (task) => !task.parentTaskId || !visibleIds.has(task.parentTaskId),
      ),
    [sortedMatched, visibleIds],
  );

  const grouped = useMemo(() => {
    const groups = state.projects
      .map((project) => {
        const tasks = sortedMatched.filter((task) => task.projectId === project.id);
        const ids = new Set(tasks.map((task) => task.id));
        const groupRoots = tasks.filter(
          (task) => !task.parentTaskId || !ids.has(task.parentTaskId) || !tasks.some((candidate) => candidate.id === task.parentTaskId),
        );
        return { project, tasks, roots: groupRoots };
      })
      .filter((group) => group.tasks.length > 0);
    return groups.sort((a, b) => {
      if (a.project.status !== b.project.status) return a.project.status === 'active' ? -1 : 1;
      const aDeadline = a.project.deadline ? new Date(a.project.deadline).getTime() : Number.MAX_SAFE_INTEGER;
      const bDeadline = b.project.deadline ? new Date(b.project.deadline).getTime() : Number.MAX_SAFE_INTEGER;
      return aDeadline - bDeadline;
    });
  }, [state.projects, sortedMatched]);

  const counts: Record<View, number> = {
    all: state.tasks.length,
    today: tasksForDate(state.tasks, today).length,
    upcoming: state.tasks.filter((task) => {
      if (task.status === 'completed') return false;
      return Boolean(
        (task.scheduledDate && task.scheduledDate > today) ||
          (task.deadline && toDateKey(task.deadline) > today),
      );
    }).length,
    overdue: leafTasks(state.tasks).filter(
      (task) => task.status !== 'completed' && task.deadline && isOverdue(task.deadline, task.deadlineHasTime, false),
    ).length,
    completed: leafTasks(state.tasks).filter((task) => task.status === 'completed').length,
    byProject: state.projects.filter((project) => projectTasks(state.tasks, project.id).length > 0).length,
  };

  const emptyCopy = (() => {
    if (filtersActive) {
      return {
        title: 'No tasks match those filters.',
        description: 'Clear the filters or widen the search. Nothing has been deleted.',
        action: (
          <Button variant="quiet" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        ),
      };
    }
    switch (view) {
      case 'today':
        return {
          title: 'Your next step starts here.',
          description: 'Nothing is scheduled or due today. Add a task, or plan the day around what is already open.',
          action: (
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" variant="primary" onClick={() => openTask()}>
                Add a task
              </Button>
              <Button size="sm" variant="quiet" onClick={openPlanner}>
                Plan the day
              </Button>
            </div>
          ),
        };
      case 'upcoming':
        return {
          title: 'The horizon is clear.',
          description: 'No open task has a future deadline or schedule yet.',
          action: (
            <Button size="sm" variant="primary" onClick={() => openTask()}>
              Add a dated task
            </Button>
          ),
        };
      case 'completed':
        return {
          title: 'Nothing finished yet.',
          description: 'Finished tasks collect here, with their XP history intact.',
          action: (
            <Button size="sm" variant="primary" onClick={() => openTask()}>
              Add a first task
            </Button>
          ),
        };
      case 'overdue':
        return {
          title: 'Nothing is overdue.',
          description: 'When a deadline passes, the task appears here instead of quietly disappearing.',
        };
      case 'byProject':
        return {
          title: 'No project has tasks yet.',
          description: 'Add a task from a project, or break a large piece of work into steps.',
          action: (
            <Button size="sm" variant="primary" onClick={() => openTask()}>
              Add a task
            </Button>
          ),
        };
      case 'all':
      default:
        return {
          title: 'A blank page. A fresh start.',
          description: 'No tasks exist yet. Start with one sentence describing what needs doing.',
          action: (
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" variant="primary" onClick={() => openTask()}>
                New task
              </Button>
              <Button size="sm" variant="quiet" onClick={() => openDecompose()}>
                <Wand2 size={12} aria-hidden />
                Split a big task
              </Button>
            </div>
          ),
        };
    }
  })();

  return (
    <div>
      <PageHeader
        index="02"
        jp=""
        title="My tasks"
        description="Every step in one place. Filter the noise out, or follow the plan you already made."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => openUnstuck({ taskId: stats.nextTask?.id ?? null })}
            >
              <LifeBuoy size={13} aria-hidden />
              I&apos;m stuck
            </Button>
            <Button variant="ghost" onClick={openCatchUp}>
              <CalendarClock size={13} aria-hidden />
              Catch up
            </Button>
            <Button variant="ghost" onClick={() => openDecompose()}>
              <Wand2 size={13} aria-hidden />
              Split a big task
            </Button>
            <Button variant="primary" onClick={() => openTask()}>
              New task
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
        {[
          { label: 'Open steps', value: stats.openTasks.length },
          { label: 'Scheduled today', value: stats.todayProgress.total },
          { label: 'Overdue', value: stats.overdueTasks.length, alert: stats.overdueTasks.length > 0 },
          { label: 'Completed', value: stats.completedTasksCount },
        ].map((item) => (
          <div key={item.label} className="bg-paper px-4 py-3">
            <p className="eyebrow mb-1">{item.label}</p>
            <p className={cn('font-mono text-[20px] leading-none', item.alert ? 'text-accent' : 'text-ink')}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <TabBar
        items={VIEWS.map((item) => ({
          ...item,
          count: counts[item.value],
        }))}
        value={view}
        onChange={changeView}
        ariaLabel="Task views"
      />

      <div className="mt-3 border border-line bg-paper">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          <div className="relative min-w-[190px] flex-1">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tasks…"
              className="border-transparent bg-surface2/30 pl-8"
              aria-label="Search tasks"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                aria-label="Clear search"
              >
                <X size={12} aria-hidden />
              </button>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setFiltersOpen((current) => !current)}
          >
            <Filter size={12} aria-hidden />
            Filters
            {activeFilterCount > 0 ? (
              <span className="ml-1 border border-accent/30 px-1 font-mono text-[10px] text-accent">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>
          <div className="hidden items-center gap-2 md:flex">
            <Select
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              aria-label="Filter by project"
              className="h-8 w-[160px] py-1 text-[13px]"
            >
              <option value="">All projects</option>
              {[...state.projects]
                .sort((a, b) => a.title.localeCompare(b.title))
                .map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
            </Select>
            <Select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value as Priority | '')}
              aria-label="Filter by priority"
              className="h-8 w-[118px] py-1 text-[13px]"
            >
              <option value="">Priority</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
            <Select
              value={difficultyFilter}
              onChange={(event) => setDifficultyFilter(event.target.value as Difficulty | '')}
              aria-label="Filter by difficulty"
              className="h-8 w-[118px] py-1 text-[13px]"
            >
              <option value="">Difficulty</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </Select>
            <Select
              value={deadlineFilter}
              onChange={(event) => setDeadlineFilter(event.target.value as DeadlineFilter)}
              aria-label="Filter by deadline"
              className="h-8 w-[128px] py-1 text-[13px]"
            >
              <option value="all">Any deadline</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due today</option>
              <option value="week">Next 7 days</option>
              <option value="none">No deadline</option>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal size={12} className="text-muted" aria-hidden />
            <Select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              aria-label="Sort tasks"
              className="h-8 w-[132px] py-1 text-[13px]"
            >
              <option value="priority">Priority</option>
              <option value="deadline">Deadline</option>
              <option value="duration">Duration</option>
              <option value="created">Newest</option>
              <option value="difficulty">Difficulty</option>
            </Select>
          </div>
          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={clearFilters}
              className="text-[12px] text-accent underline decoration-accent/40 underline-offset-2"
            >
              Clear {activeFilterCount}
            </button>
          ) : null}
        </div>

        {filtersOpen ? (
          <div className="grid gap-2 border-t border-line px-3 py-3 md:hidden">
            <Select
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              aria-label="Filter by project"
              className="h-9 text-[14px]"
            >
              <option value="">All projects</option>
              {[...state.projects]
                .sort((a, b) => a.title.localeCompare(b.title))
                .map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
            </Select>
            <div className="grid grid-cols-3 gap-2">
              <Select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value as Priority | '')}
                aria-label="Filter by priority"
                className="h-9 text-[13px]"
              >
                <option value="">Priority</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </Select>
              <Select
                value={difficultyFilter}
                onChange={(event) => setDifficultyFilter(event.target.value as Difficulty | '')}
                aria-label="Filter by difficulty"
                className="h-9 text-[13px]"
              >
                <option value="">Difficulty</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </Select>
              <Select
                value={deadlineFilter}
                onChange={(event) => setDeadlineFilter(event.target.value as DeadlineFilter)}
                aria-label="Filter by deadline"
                className="h-9 text-[13px]"
              >
                <option value="all">Deadline</option>
                <option value="overdue">Overdue</option>
                <option value="today">Today</option>
                <option value="week">7 days</option>
                <option value="none">None</option>
              </Select>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        {matched.length === 0 ? (
          <EmptyState
            icon={<ListChecks size={19} aria-hidden />}
            eyebrow={filtersActive ? 'No results' : 'Empty'}
            title={emptyCopy.title}
            description={emptyCopy.description}
            action={emptyCopy.action}
          />
        ) : view === 'byProject' ? (
          <div className="space-y-5">
            {grouped.map(({ project, tasks, roots: groupRoots }) => {
              const progress = projectProgress(project, state.tasks);
              return (
                <section key={project.id} className="border border-line bg-paper">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
                    <div className="min-w-0">
                      <a
                        href={`/projects/${project.id}`}
                        className="text-[14px] text-ink underline decoration-transparent underline-offset-4 transition-colors hover:decoration-accent"
                      >
                        {project.title}
                      </a>
                      <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
                        {progress.percent}% · {progress.completed}/{progress.total} tasks ·{' '}
                        {project.status}
                      </p>
                    </div>
                    <span className="font-mono text-[11px] text-muted">{tasks.length} shown</span>
                  </div>
                  {groupRoots.map((task) => (
                    <TaskRow key={task.id} task={task} showProject={false} />
                  ))}
                  {groupRoots.length === 0 ? (
                    <p className="px-4 py-4 text-[13px] text-muted">
                      These matches are all nested under a task that does not match. Switch to the
                      flat view or clear filters to see them.
                    </p>
                  ) : null}
                </section>
              );
            })}
          </div>
        ) : (
          <div className="border border-line bg-paper">
            {roots.map((task) => (
              <TaskRow key={task.id} task={task} flat={flatMode} showProject />
            ))}
          </div>
        )}
      </div>

      {view === 'byProject' && matched.length > 0 && flatMode ? (
        <p className="mt-3 text-[12px] text-muted">
          Filters are applied; nested tasks that only match through a parent may need the flat
          “All” view.
        </p>
      ) : null}
    </div>
  );
}
