import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  ArrowUpRight,
  CalendarRange,
  CheckSquare,
  CornerDownLeft,
  FolderOpen,
  LayoutGrid,
  MessageCircle,
  Plus,
  Search,
  Settings,
  Timer,
  Wand2,
  type LucideIcon,
} from 'lucide-react';
import { useTakTic } from '../../store/TakTicProvider';
import { NAV_ITEMS } from '../../data/navigation';
import { ACHIEVEMENTS } from '../../services/gamification/achievements';
import { projectProgress, openLeaves } from '../../utils/tasks';
import { formatDuration } from '../../utils/date';
import { cn } from '../../utils/cn';

type PaletteMode = 'command' | 'search';

interface PaletteItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: LucideIcon;
  onSelect: () => void;
  trailing?: string;
}

interface CommandPaletteProps {
  open: boolean;
  mode: PaletteMode;
  onClose: () => void;
  onOpenTask: (taskId: string) => void;
  onCreateTask: () => void;
  onCreateProject: () => void;
  onOpenDecompose: () => void;
  onOpenPlanner: () => void;
}

export function CommandPalette({
  open,
  mode,
  onClose,
  onOpenTask,
  onCreateTask,
  onCreateProject,
  onOpenDecompose,
  onOpenPlanner,
}: CommandPaletteProps) {
  const { state } = useTakTic();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, mode]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (value: string | undefined) =>
      !q || (value ? value.toLowerCase().includes(q) : false);
    const go = (path: string) => () => {
      onClose();
      navigate(path);
    };

    const taskMatches = state.tasks
      .filter((task) => {
        if (!q) return false;
        const project = state.projects.find((candidate) => candidate.id === task.projectId);
        return (
          matches(task.title) || matches(task.description) || matches(project?.title)
        );
      })
      .slice(0, 6);

    const recentTasks = [...openLeaves(state.tasks)]
      .sort((a, b) => {
        const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
        const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
        return aDeadline - bDeadline;
      })
      .slice(0, 4);

    const taskItems: PaletteItem[] = (q ? taskMatches : recentTasks).map((task) => {
      const project = state.projects.find((candidate) => candidate.id === task.projectId);
      return {
        id: `task-${task.id}`,
        label: task.title,
        sublabel: `${project?.title ?? 'No project'} · ${formatDuration(task.estimatedMinutes)}`,
        icon: CheckSquare,
        trailing: task.status === 'completed' ? 'done' : undefined,
        onSelect: () => {
          onClose();
          navigate('/tasks');
          onOpenTask(task.id);
        },
      };
    });

    const projectMatches = state.projects
      .filter(
        (project) =>
          !q || matches(project.title) || matches(project.description),
      )
      .slice(0, q ? 4 : 3);

    const projectItems: PaletteItem[] = projectMatches.map((project) => {
      const progress = projectProgress(project, state.tasks);
      return {
        id: `project-${project.id}`,
        label: project.title,
        sublabel: `${progress.percent}% complete · ${progress.completed}/${progress.total} tasks`,
        icon: FolderOpen,
        onSelect: () => {
          onClose();
          navigate(`/projects/${project.id}`);
        },
      };
    });

    const achievementMatches = ACHIEVEMENTS.filter(
      (achievement) =>
        q && (matches(achievement.name) || matches(achievement.description)),
    ).slice(0, 3);

    const achievementItems: PaletteItem[] = achievementMatches.map((achievement) => ({
      id: `achievement-${achievement.id}`,
      label: achievement.name,
      sublabel: achievement.description,
      icon: Award,
      trailing: 'achievement',
      onSelect: () => {
        onClose();
        navigate(`/achievements#${achievement.id}`);
      },
    }));

    const actionItems: PaletteItem[] = [
      {
        id: 'action-new-task',
        label: 'Create a task',
        sublabel: 'A small, concrete next step',
        icon: Plus,
        trailing: 'N',
        onSelect: () => {
          onClose();
          onCreateTask();
        },
      },
      {
        id: 'action-new-project',
        label: 'Create a project',
        sublabel: 'A container for related work',
        icon: FolderOpen,
        onSelect: () => {
          onClose();
          onCreateProject();
        },
      },
      {
        id: 'action-decompose',
        label: 'Split a big task',
        sublabel: 'Turn it into small steps',
        icon: Wand2,
        onSelect: () => {
          onClose();
          onOpenDecompose();
        },
      },
      {
        id: 'action-plan',
        label: 'Plan my day',
        sublabel: 'Build a realistic schedule',
        icon: CalendarRange,
        onSelect: () => {
          onClose();
          onOpenPlanner();
        },
      },
      {
        id: 'action-focus',
        label: 'Start the focus timer',
        sublabel: 'Work in a quiet view',
        icon: Timer,
        onSelect: go('/focus'),
      },
      {
        id: 'action-companion',
        label: 'Ask AI',
        sublabel: 'Help with what is in front of you',
        icon: MessageCircle,
        onSelect: go('/companion'),
      },
      {
        id: 'action-settings',
        label: 'Open settings',
        sublabel: 'Appearance, focus, AI and data',
        icon: Settings,
        onSelect: go('/settings'),
      },
    ].filter((action) => !q || matches(action.label) || matches(action.sublabel));

    const pageItems: PaletteItem[] = NAV_ITEMS.filter(
      (item) =>
        !q ||
        matches(item.label) ||
        matches(item.jp) ||
        matches(item.path.replace('/', '')),
    ).map((item) => ({
      id: `page-${item.path}`,
      label: item.label,
      sublabel: item.jp,
      icon: item.icon,
      trailing: item.index,
      onSelect: go(item.path),
    }));

    if (q) {
      return [
        { title: 'Tasks', items: taskItems },
        { title: 'Projects', items: projectItems },
        { title: 'Achievements', items: achievementItems },
        { title: 'Actions', items: actionItems },
        { title: 'Sections', items: pageItems },
      ].filter((group) => group.items.length > 0);
    }

    return [
      { title: 'Quick actions', items: actionItems.slice(0, 4) },
      { title: 'Pick up where you left off', items: taskItems },
      { title: 'Projects', items: projectItems },
      { title: 'Sections', items: pageItems },
    ].filter((group) => group.items.length > 0);
  }, [
    query,
    state.tasks,
    state.projects,
    navigate,
    onClose,
    onOpenTask,
    onCreateTask,
    onCreateProject,
    onOpenDecompose,
    onOpenPlanner,
  ]);

  const flat = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  useEffect(() => {
    if (activeIndex > flat.length - 1) setActiveIndex(Math.max(0, flat.length - 1));
  }, [flat.length, activeIndex]);

  useEffect(() => {
    const element = document.getElementById(`palette-item-${activeIndex}`);
    element?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, Math.max(0, flat.length - 1)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(0, current - 1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      flat[activeIndex]?.onSelect();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  let runningIndex = -1;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[120] flex items-start justify-center px-3 pt-[8vh] sm:px-6 sm:pt-[12vh]">
          <motion.button
            type="button"
            aria-label="Close command palette"
            className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            tabIndex={-1}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex max-h-[76vh] w-full max-w-xl flex-col border border-line bg-paper shadow-lift"
          >
            <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
              <Search size={16} className="shrink-0 text-muted" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  mode === 'search'
                    ? 'Search tasks, projects, achievements…'
                    : 'Type a command, or search the workspace…'
                }
                className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-muted/70"
                aria-label="Search and commands"
                aria-controls="palette-results"
                aria-activedescendant={
                  flat[activeIndex] ? `palette-item-${activeIndex}` : undefined
                }
                role="combobox"
                aria-expanded
                autoComplete="off"
              />
              <kbd className="hidden shrink-0 border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted sm:block">
                Esc
              </kbd>
            </div>

            <div
              ref={listRef}
              id="palette-results"
              className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 py-2"
              role="listbox"
            >
              {flat.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="font-serif text-[17px] text-ink">Nothing matches that.</p>
                  <p className="mt-1.5 text-[14px] leading-5 text-muted">
                    Try a shorter phrase, a project name, or a section.
                  </p>
                </div>
              ) : (
                groups.map((group) => (
                  <div key={group.title} className="mb-1.5">
                    <p className="px-2.5 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                      {group.title}
                    </p>
                    {group.items.map((item) => {
                      runningIndex += 1;
                      const index = runningIndex;
                      const Icon = item.icon;
                      const active = index === activeIndex;
                      return (
                        <button
                          key={item.id}
                          id={`palette-item-${index}`}
                          role="option"
                          aria-selected={active}
                          type="button"
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={item.onSelect}
                          className={cn(
                            'flex w-full items-center gap-3 px-2.5 py-2 text-left transition-colors',
                            active ? 'bg-accent-soft' : 'hover:bg-surface2/60',
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-7 w-7 shrink-0 items-center justify-center border',
                              active ? 'border-accent/40 text-accent' : 'border-line text-muted',
                            )}
                          >
                            <Icon size={13} aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] text-ink">
                              {item.label}
                            </span>
                            {item.sublabel ? (
                              <span className="mt-0.5 block truncate text-[12px] text-muted">
                                {item.sublabel}
                              </span>
                            ) : null}
                          </span>
                          {item.trailing ? (
                            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                              {item.trailing}
                            </span>
                          ) : null}
                          {active ? (
                            <CornerDownLeft size={12} className="shrink-0 text-accent" aria-hidden />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between border-t border-line px-4 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
              <span className="inline-flex items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <ArrowUpRight size={10} aria-hidden /> Navigate
                </span>
                <span className="inline-flex items-center gap-1">
                  <CornerDownLeft size={10} aria-hidden /> Open
                </span>
              </span>
              <span className="inline-flex items-center gap-1">
                <LayoutGrid size={10} aria-hidden />
                {mode === 'search' ? 'Search' : 'Commands'}
              </span>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
