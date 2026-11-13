import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Coffee, Play } from 'lucide-react';
import type { FocusSession } from '../../types';
import { useTakTic } from '../../store/TakTicProvider';
import { useToast } from '../ui/ToastProvider';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Textarea } from '../ui/Form';
import { InlineNote } from '../ui/Feedback';
import { formatTime } from '../../utils/date';
import { childrenOf } from '../../utils/tasks';

interface ReviewModalProps {
  session: FocusSession | null;
  onClose: () => void;
}

export function ReviewModal({ session, onClose }: ReviewModalProps) {
  const { state, dispatch } = useTakTic();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setNotes(session?.notes ?? '');
  }, [session?.id, session?.notes]);

  if (!session) return null;

  const task = session.taskId
    ? state.tasks.find((candidate) => candidate.id === session.taskId)
    : undefined;
  const completed = session.status === 'completed';
  const isLeaf = task ? childrenOf(state.tasks, task.id).length === 0 : false;
  const actualMinutes = Math.max(1, Math.round(session.actualSeconds / 60));
  const nextBreakType =
    state.focusCycle >= state.settings.focus.sessionsBeforeLongBreak ? 'long' : 'short';
  const breakMinutes =
    nextBreakType === 'long'
      ? state.settings.focus.longBreakMinutes
      : state.settings.focus.shortBreakMinutes;

  const close = (noteOverride?: string) => {
    const text = noteOverride ?? notes;
    if (text.trim().length > 0 && text !== (session.notes ?? '')) {
      dispatch({ type: 'UPDATE_SESSION_NOTES', sessionId: session.id, notes: text.trim() });
    }
    dispatch({ type: 'DISMISS_REVIEW' });
    onClose();
  };

  const saveNote = () => {
    close();
    toast({ title: 'Session note saved', description: 'Recorded with the focus session.', duration: 2600 });
  };

  const completeTask = () => {
    if (!task) return;
    close();
    dispatch({ type: 'TOGGLE_TASK', id: task.id });
  };

  const keepWorking = () => {
    close();
    dispatch({
      type: 'START_SESSION',
      sessionType: 'focus',
      taskId: session.taskId,
      plannedSeconds: state.settings.focus.focusMinutes * 60,
    });
    navigate('/focus');
    toast({ title: 'Another focus block started', duration: 2400 });
  };

  const takeBreak = () => {
    close();
    dispatch({
      type: 'START_SESSION',
      sessionType: nextBreakType,
      taskId: null,
      plannedSeconds: breakMinutes * 60,
    });
    navigate('/focus');
    toast({ title: 'Break started', description: `${breakMinutes} minutes. Step away from the desk.`, duration: 3200 });
  };

  const startFocusAfterBreak = () => {
    close();
    dispatch({
      type: 'START_SESSION',
      sessionType: 'focus',
      taskId: session.taskId,
      plannedSeconds: state.settings.focus.focusMinutes * 60,
    });
    navigate('/focus');
  };

  return (
    <Modal
      open
      onClose={() => close()}
      eyebrow={completed ? 'Focus session complete' : 'Session ended'}
      title={
        completed
          ? 'What did you accomplish?'
          : 'The session ended early'
      }
      description={
        completed
          ? 'A sentence is enough. It helps you see progress that is easy to forget.'
          : 'No XP is awarded for an unfinished session, but the time is recorded against the task.'
      }
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={() => close()} className="mr-auto">
            Close
          </Button>
          {completed ? (
            <>
              <Button variant="ghost" onClick={saveNote}>
                Save note
              </Button>
              <Button variant="secondary" onClick={keepWorking}>
                Keep working
              </Button>
              <Button variant="secondary" onClick={takeBreak}>
                <Coffee size={13} aria-hidden />
                {breakMinutes} min break
              </Button>
              {task && task.status !== 'completed' && isLeaf ? (
                <Button variant="primary" onClick={completeTask}>
                  <Check size={13} aria-hidden />
                  Complete task
                </Button>
              ) : (
                <Button variant="primary" onClick={() => close()}>
                  Done
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={startFocusAfterBreak}>
                <Play size={13} aria-hidden />
                Start a focus block
              </Button>
              <Button variant="primary" onClick={() => close()}>
                Done
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-px border border-line bg-line sm:grid-cols-3">
          <div className="bg-paper px-3 py-2.5">
            <p className="eyebrow mb-1">Planned</p>
            <p className="font-mono text-[16px] text-ink">
              {Math.round(session.plannedSeconds / 60)} min
            </p>
          </div>
          <div className="bg-paper px-3 py-2.5">
            <p className="eyebrow mb-1">Actual</p>
            <p className="font-mono text-[16px] text-ink">{actualMinutes} min</p>
          </div>
          <div className="bg-paper px-3 py-2.5">
            <p className="eyebrow mb-1">XP</p>
            <p className="font-mono text-[16px] text-ink">
              {completed ? `+${state.settings.xp.focus}` : '0'}
            </p>
          </div>
        </div>

        {task ? (
          <div className="border border-line px-3 py-2.5">
            <p className="eyebrow mb-1">Task</p>
            <p className="text-[13px] leading-5 text-ink">{task.title}</p>
            <p className="mt-1 font-mono text-[9.5px] text-muted">
              Session ended {formatTime(session.endTime)}
            </p>
          </div>
        ) : (
          <InlineNote>This session was not attached to a task.</InlineNote>
        )}

        {completed ? (
          <Field
            label="Your note"
            htmlFor="review-notes"
            hint="What changed, even slightly? Saved with the session."
          >
            <Textarea
              id="review-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              maxLength={600}
              placeholder="e.g. Finished the innate immunity notes and wrote three questions."
              data-autofocus="true"
            />
          </Field>
        ) : (
          <InlineNote>
            Starting again is part of the process. The recorded time is already on the task, and
            nothing has been taken away.
          </InlineNote>
        )}

        {completed ? (
          <p className="font-mono text-[9.5px] leading-5 text-muted">
            {state.focusCycle >= state.settings.focus.sessionsBeforeLongBreak
              ? 'You have completed a full focus cycle. A longer break is suggested.'
              : `${state.focusCycle} of ${state.settings.focus.sessionsBeforeLongBreak} focus sessions in this cycle.`}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
