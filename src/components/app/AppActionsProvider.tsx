import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useTakTic } from '../../store/TakTicProvider';
import { TaskModal } from '../tasks/TaskModal';
import { ProjectModal } from '../projects/ProjectModal';
import { DecomposeModal } from '../tasks/DecomposeModal';
import { PlannerModal } from '../dashboard/PlannerModal';
import { CatchUpModal } from '../dashboard/CatchUpModal';
import { TroubleModal } from '../tasks/TroubleModal';
import { ReviewModal } from '../focus/ReviewModal';
import { CommandPalette } from '../layout/CommandPalette';
import { GuidedTour } from './GuidedTour';

interface TaskOpenOptions {
  taskId?: string | null;
  projectId?: string | null;
  parentTaskId?: string | null;
  initialDeadlineDate?: string | null;
}

interface DecomposeOpenOptions {
  taskId?: string | null;
  projectId?: string | null;
  seedTitle?: string;
}

interface AppActionsValue {
  openTask: (options?: TaskOpenOptions) => void;
  openProject: (projectId?: string | null) => void;
  openDecompose: (options?: DecomposeOpenOptions) => void;
  openPlanner: () => void;
  openCatchUp: () => void;
  openUnstuck: (options?: { taskId?: string | null }) => void;
  openPalette: (mode?: 'command' | 'search') => void;
  openTour: () => void;
}

const AppActionsContext = createContext<AppActionsValue | null>(null);

type TaskModalState = {
  taskId: string | null;
  projectId: string | null;
  parentTaskId: string | null;
  initialDeadlineDate: string | null;
} | null;

type ProjectModalState = {
  projectId: string | null;
  onCreated?: (projectId: string) => void;
} | null;

type DecomposeModalState = {
  taskId: string | null;
  projectId: string | null;
  seedTitle?: string;
} | null;

export function AppActionsProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useTakTic();
  const navigate = useNavigate();

  const [taskModal, setTaskModal] = useState<TaskModalState>(null);
  const [projectModal, setProjectModal] = useState<ProjectModalState>(null);
  const [decomposeModal, setDecomposeModal] = useState<DecomposeModalState>(null);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [catchUpOpen, setCatchUpOpen] = useState(false);
  const [unstuck, setUnstuck] = useState<{ open: boolean; taskId: string | null }>({
    open: false,
    taskId: null,
  });
  const [palette, setPalette] = useState<{ open: boolean; mode: 'command' | 'search' }>({
    open: false,
    mode: 'command',
  });
  const [tourOpen, setTourOpen] = useState(false);

  const openTask = useCallback((options?: TaskOpenOptions) => {
    setTaskModal({
      taskId: options?.taskId ?? null,
      projectId: options?.projectId ?? null,
      parentTaskId: options?.parentTaskId ?? null,
      initialDeadlineDate: options?.initialDeadlineDate ?? null,
    });
  }, []);

  const openProject = useCallback((projectId?: string | null) => {
    setProjectModal({ projectId: projectId ?? null });
  }, []);

  const openDecompose = useCallback((options?: DecomposeOpenOptions) => {
    setDecomposeModal({
      taskId: options?.taskId ?? null,
      projectId: options?.projectId ?? null,
      seedTitle: options?.seedTitle,
    });
  }, []);

  const openPlanner = useCallback(() => setPlannerOpen(true), []);
  const openCatchUp = useCallback(() => setCatchUpOpen(true), []);
  const openUnstuck = useCallback(
    (options?: { taskId?: string | null }) =>
      setUnstuck({ open: true, taskId: options?.taskId ?? null }),
    [],
  );
  const openPalette = useCallback(
    (mode: 'command' | 'search' = 'command') => setPalette({ open: true, mode }),
    [],
  );
  const openTour = useCallback(() => setTourOpen(true), []);
  const closePalette = useCallback(
    () => setPalette((current) => ({ ...current, open: false })),
    [],
  );

  const paletteOpenRef = useRef(false);
  paletteOpenRef.current = palette.open;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPalette((current) =>
          current.open
            ? { ...current, open: false }
            : { open: true, mode: 'command' },
        );
        return;
      }
      if (!state.settings.shortcutsEnabled) return;
      if (modifier || event.altKey) return;
      if (event.key.toLowerCase() !== 'n') return;
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.matches('input, textarea, select, [contenteditable="true"]') ?? false;
      const dialogOpen = document.querySelector('[role="dialog"]');
      if (isTyping || dialogOpen || paletteOpenRef.current) return;
      event.preventDefault();
      openTask();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openTask, state.settings.shortcutsEnabled]);

  const reviewSession = state.focusSessions.find(
    (session) => session.id === state.pendingReviewSessionId,
  );

  const value = useMemo<AppActionsValue>(
    () => ({
      openTask,
      openProject,
      openDecompose,
      openPlanner,
      openCatchUp,
      openUnstuck,
      openPalette,
      openTour,
    }),
    [
      openTask,
      openProject,
      openDecompose,
      openPlanner,
      openCatchUp,
      openUnstuck,
      openPalette,
      openTour,
    ],
  );

  return (
    <AppActionsContext.Provider value={value}>
      {children}

      <TaskModal
        open={Boolean(taskModal)}
        taskId={taskModal?.taskId}
        projectId={taskModal?.projectId}
        parentTaskId={taskModal?.parentTaskId}
        initialDeadlineDate={taskModal?.initialDeadlineDate}
        onClose={() => setTaskModal(null)}
        onRequestProject={() => {
          setTaskModal(null);
          setProjectModal({
            projectId: null,
            onCreated: (projectId) => {
              setProjectModal(null);
              setTaskModal({
                taskId: null,
                projectId,
                parentTaskId: null,
                initialDeadlineDate: taskModal?.initialDeadlineDate ?? null,
              });
            },
          });
        }}
        onBreakDown={(taskId) => {
          setTaskModal(null);
          setDecomposeModal({ taskId, projectId: null });
        }}
        onUnstuck={(taskId) => {
          setTaskModal(null);
          setUnstuck({ open: true, taskId });
        }}
        onStartFocus={(taskId) => {
          setTaskModal(null);
          navigate(`/focus?task=${taskId}`);
        }}
      />

      <ProjectModal
        open={Boolean(projectModal)}
        projectId={projectModal?.projectId}
        onClose={() => setProjectModal(null)}
        onCreated={projectModal?.onCreated}
      />

      <DecomposeModal
        open={Boolean(decomposeModal)}
        taskId={decomposeModal?.taskId}
        projectId={decomposeModal?.projectId}
        seedTitle={decomposeModal?.seedTitle}
        onClose={() => setDecomposeModal(null)}
        onCreated={(projectId) => navigate(`/projects/${projectId}`)}
      />

      <PlannerModal open={plannerOpen} onClose={() => setPlannerOpen(false)} />
      <CatchUpModal open={catchUpOpen} onClose={() => setCatchUpOpen(false)} />
      <TroubleModal
        open={unstuck.open}
        task={state.tasks.find((task) => task.id === unstuck.taskId) ?? null}
        onClose={() => setUnstuck({ open: false, taskId: null })}
      />

      <CommandPalette
        open={palette.open}
        mode={palette.mode}
        onClose={closePalette}
        onOpenTask={(taskId) => openTask({ taskId })}
        onCreateTask={() => openTask()}
        onCreateProject={() => openProject()}
        onOpenDecompose={() => openDecompose()}
        onOpenPlanner={openPlanner}
        onOpenCatchUp={openCatchUp}
        onOpenUnstuck={() => openUnstuck()}
        onOpenTour={openTour}
      />

      <GuidedTour open={tourOpen} onClose={() => setTourOpen(false)} />

      <ReviewModal
        session={reviewSession ?? null}
        onClose={() => dispatch({ type: 'DISMISS_REVIEW' })}
      />
    </AppActionsContext.Provider>
  );
}

export function useAppActions(): AppActionsValue {
  const context = useContext(AppActionsContext);
  if (!context) throw new Error('useAppActions must be used inside AppActionsProvider.');
  return context;
}
