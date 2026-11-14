import { useMemo, useState } from 'react';
import { FolderOpen, Plus } from 'lucide-react';
import { useTakTic } from '../store/TakTicProvider';
import { useAppActions } from '../components/app/AppActionsProvider';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { TabBar } from '../components/ui/Tabs';
import { EmptyState } from '../components/ui/Feedback';
import { ProjectCard } from '../components/projects/ProjectCard';

type Filter = 'active' | 'completed' | 'all';

export function ProjectsPage() {
  const { state, stats } = useTakTic();
  const { openProject, openTask, openDecompose } = useAppActions();
  const [filter, setFilter] = useState<Filter>('active');

  const counts = useMemo(
    () => ({
      active: state.projects.filter((project) => project.status === 'active').length,
      completed: state.projects.filter((project) => project.status === 'completed').length,
      all: state.projects.length,
    }),
    [state.projects],
  );

  const summaries = stats.projectSummaries.filter((summary) => {
    if (filter === 'all') return true;
    return summary.project.status === filter;
  });

  const emptyState =
    filter === 'completed'
      ? {
          title: 'No completed projects yet.',
          description:
            'When every actionable task in a project is finished, the project closes itself and records the date. XP is awarded once.',
          action: (
            <Button variant="quiet" onClick={() => setFilter('active')}>
              View active projects
            </Button>
          ),
        }
      : filter === 'active'
        ? {
            title: 'No active projects.',
            description: 'Create a project for work that still feels vague, then add a first step.',
            action: (
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" onClick={() => openProject()}>
                  <Plus size={13} aria-hidden />
                  Create a project
                </Button>
                <Button variant="quiet" onClick={() => openDecompose()}>
                  Split a big task
                </Button>
              </div>
            ),
          }
        : {
            title: 'No projects yet.',
            description: 'Projects gather related steps. Create one first, then add tasks or let AI break it down.',
            action: (
              <Button variant="primary" onClick={() => openProject()}>
                Create a project
              </Button>
            ),
          };

  return (
    <div>
      <PageHeader
        index="03"
        jp=""
        title="Projects"
        description="Projects hold related work. Progress counts finished steps, not folders or phases."
        actions={
          <>
            <Button variant="secondary" onClick={() => openTask()}>
              New task
            </Button>
            <Button variant="primary" onClick={() => openProject()}>
              <Plus size={13} aria-hidden />
              New project
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-3 gap-px border border-line bg-line">
        {[
          { label: 'Active', value: counts.active },
          { label: 'Completed', value: counts.completed },
          { label: 'Actionable steps', value: stats.projectSummaries.reduce((sum, summary) => sum + summary.progress.total, 0) },
        ].map((item) => (
          <div key={item.label} className="bg-paper px-4 py-3">
            <p className="eyebrow mb-1">{item.label}</p>
            <p className="font-mono text-[20px] leading-none text-ink">{item.value}</p>
          </div>
        ))}
      </div>

      <TabBar
        items={[
          { value: 'active', label: 'Active', count: counts.active },
          { value: 'completed', label: 'Completed', count: counts.completed },
          { value: 'all', label: 'All', count: counts.all },
        ]}
        value={filter}
        onChange={setFilter}
        ariaLabel="Project filters"
      />

      <div className="mt-4">
        {summaries.length === 0 ? (
          <EmptyState
            icon={<FolderOpen size={20} aria-hidden />}
            eyebrow={filter === 'completed' ? 'Nothing completed' : 'Empty board'}
            title={emptyState.title}
            description={emptyState.description}
            action={emptyState.action}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {summaries.map(({ project }) => (
              <ProjectCard key={project.id} project={project} tasks={state.tasks} />
            ))}
          </div>
        )}
      </div>

      <p className="mt-6 border-t border-line pt-4 text-[12px] leading-5 text-muted">
        A project closes when all of its leaf tasks are complete. Reopening one task reopens the
        project without removing any XP that was already earned.
      </p>
    </div>
  );
}
