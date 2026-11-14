import { useEffect, useState } from 'react';
import type { Priority } from '../../types';
import { useTakTic } from '../../store/TakTicProvider';
import { useToast } from '../ui/ToastProvider';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Input, Select, Textarea } from '../ui/Form';
import { buildProject } from '../../utils/factories';
import { isoFromDateAndTime, splitDeadline } from '../../utils/date';

interface ProjectModalProps {
  open: boolean;
  projectId?: string | null;
  onClose: () => void;
  onCreated?: (projectId: string) => void;
}

export function ProjectModal({ open, projectId, onClose, onCreated }: ProjectModalProps) {
  const { state, dispatch } = useTakTic();
  const { toast } = useToast();
  const project = projectId
    ? state.projects.find((candidate) => candidate.id === projectId)
    : undefined;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (project) {
      setTitle(project.title);
      setDescription(project.description);
      setDeadline(splitDeadline(project.deadline, false).dateKey);
      setPriority(project.priority);
    } else {
      setTitle('');
      setDescription('');
      setDeadline('');
      setPriority('medium');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  const handleSave = () => {
    const nextErrors: Record<string, string> = {};
    if (title.trim().length < 2) nextErrors.title = 'Give the project a name of at least two characters.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const deadlineIso = deadline ? isoFromDateAndTime(deadline, null) : null;

    if (project) {
      dispatch({
        type: 'UPDATE_PROJECT',
        id: project.id,
        patch: {
          title: title.trim(),
          description: description.trim(),
          deadline: deadlineIso,
          priority,
        },
      });
      toast({ title: 'Project updated', tone: 'success' });
      onClose();
      return;
    }

    const newProject = buildProject({
      title,
      description,
      deadline: deadlineIso,
      priority,
    });
    dispatch({ type: 'ADD_PROJECT', project: newProject });
    toast({
      title: 'Project created',
      description: 'Add a first task, or break the project down with AI.',
      tone: 'success',
    });
    onClose();
    onCreated?.(newProject.id);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={project ? 'Edit project' : 'New project'}
      eyebrow={project ? 'Project detail' : 'Set a direction'}
      description={
        project
          ? 'Projects gather related tasks and track completion without double-counting.'
          : 'Organise a larger goal into smaller tasks. A project is the goal; the tasks are the steps.'
      }
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {project ? 'Save changes' : 'Create project'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Project name" htmlFor="project-title" required error={errors.title}>
          <Input
            id="project-title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setErrors({});
            }}
            placeholder="e.g. Biology Research Assignment"
            data-autofocus="true"
            maxLength={140}
          />
        </Field>
        <Field
          label="Description"
          htmlFor="project-description"
          hint="What outcome are you working toward? Optional."
        >
          <Textarea
            id="project-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="A sentence or two about the outcome you want."
            maxLength={1000}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Deadline" htmlFor="project-deadline" hint="Optional.">
            <Input
              id="project-deadline"
              type="date"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </Field>
          <Field label="Priority" htmlFor="project-priority">
            <Select
              id="project-priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </Field>
        </div>
        {project ? (
          <p className="border-t border-line pt-3 font-mono text-[11px] leading-5 text-muted">
            Created {new Date(project.createdAt).toLocaleDateString('en-GB')} · Last updated{' '}
            {new Date(project.updatedAt).toLocaleDateString('en-GB')}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
