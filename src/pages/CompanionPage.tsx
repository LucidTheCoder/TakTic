import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  Timer,
  Trash2,
} from 'lucide-react';
import { useTakTic } from '../store/TakTicProvider';
import { useAppActions } from '../components/app/AppActionsProvider';
import { useToast } from '../components/ui/ToastProvider';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/Modal';
import { Textarea } from '../components/ui/Form';
import { InlineNote, Spinner } from '../components/ui/Feedback';
import { PriorityBadge } from '../components/ui/Badges';
import { uid } from '../utils/id';
import {
  formatDateKey,
  formatLongDate,
  formatTime,
  todayKey,
  toDateKey,
  humanRelative,
} from '../utils/date';
import { leafTasks, projectProgress } from '../utils/tasks';
import { describeAiError, isAiConfigured } from '../services/ai/client';
import { generateCompanionResponse } from '../services/ai';
import { FEEDBACK_OPTIONS } from '../data/feedback';
import { cn } from '../utils/cn';

export function CompanionPage() {
  const { state, stats, dispatch } = useTakTic();
  const { openTask } = useAppActions();
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const aiReady = isAiConfigured(state.settings.ai);

  const context = useMemo(() => {
    const today = todayKey();
    const projectLines = state.projects
      .map((project) => {
        const progress = projectProgress(project, state.tasks);
        return `- "${project.title}": ${progress.completed} of ${progress.total} actionable tasks complete (${progress.percent}%), status ${project.status}, priority ${project.priority}${
          project.deadline
            ? `, deadline ${formatDateKey(toDateKey(project.deadline), { day: 'numeric', month: 'short' })}`
            : ''
        }`;
      })
      .join('\n');
    const openLines = stats.openTasks
      .slice(0, 24)
      .map((task) => {
        const project = state.projects.find((candidate) => candidate.id === task.projectId);
        return `- id=${task.id} | "${task.title}" | project=${project?.title ?? 'none'} | ${task.estimatedMinutes} min | ${task.priority} priority | ${task.difficulty} | ${
          task.deadline
            ? `deadline ${formatDateKey(toDateKey(task.deadline), { day: 'numeric', month: 'short' })}`
            : 'no deadline'
        }${task.scheduledDate === today ? ' | scheduled today' : ''}${
          task.status === 'blocked' ? ` | blocked: ${task.blockedReason ?? 'no reason'}` : ''
        }`;
      })
      .join('\n');
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const focusLastSeven = state.focusSessions
      .filter(
        (session) =>
          session.type === 'focus' &&
          session.status === 'completed' &&
          new Date(session.startTime).getTime() >= sevenDaysAgo.getTime(),
      )
      .reduce((sum, session) => sum + Math.round(session.actualSeconds / 60), 0);
    const completedToday = leafTasks(state.tasks).filter(
      (task) => task.completedAt && toDateKey(task.completedAt) === today,
    ).length;
    const adaptations = state.adaptations
      .slice(-4)
      .map((record) => {
        const task = state.tasks.find((candidate) => candidate.id === record.taskId);
        const feedback = FEEDBACK_OPTIONS.find((option) => option.id === record.feedbackType);
        return `- "${task?.title ?? 'deleted task'}" was adapted for "${feedback?.label ?? record.feedbackType}"`;
      })
      .join('\n');

    return `Today: ${formatLongDate()} (${today}).
Student: ${state.profile.displayName}. Level ${stats.level.level}, ${state.profile.xp} total XP.
Current streak: ${state.streak.currentStreak} days. Longest: ${state.streak.longestStreak}. Total active days: ${state.streak.totalActiveDays}.
Today: ${stats.todayProgress.total} tasks scheduled or due, ${stats.todayProgress.completed} completed, ${completedToday} actually completed today. Focus today: ${stats.todayFocusMinutes} minutes. Overdue open tasks: ${stats.overdueTasks.length}.
Focus in the last seven days: ${focusLastSeven} minutes.

PROJECTS:
${projectLines || '- none'}

OPEN ACTIONABLE TASKS (real ids; never invent):
${openLines || '- none'}

RECENT FOCUS:
- Today: ${stats.todayFocusSessions} completed focus sessions, ${stats.todayFocusMinutes} minutes.
- This week: ${stats.weekFocusMinutes} minutes.

RECENT DIFFICULTIES ADAPTED:
${adaptations || '- none'}`;
  }, [state, stats]);

  const history = state.companionMessages.slice(-8).map((message) => ({
    role: message.role,
    content: message.content,
  }));

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [state.companionMessages.length, sending]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    if (!aiReady) {
      toast({
        title: 'AI companion not connected',
        description: 'Add an OpenRouter API key in Settings to talk to the companion.',
        tone: 'error',
      });
      return;
    }
    dispatch({
      type: 'ADD_COMPANION_MESSAGE',
      message: {
        id: uid('msg'),
        role: 'user',
        content: message,
        createdAt: new Date().toISOString(),
      },
    });
    setInput('');
    setSending(true);
    try {
      const result = await generateCompanionResponse({
        message,
        context,
        history,
        style: state.settings.ai.companionStyle,
        config: state.settings.ai,
      });
      dispatch({
        type: 'ADD_COMPANION_MESSAGE',
        message: {
          id: uid('msg'),
          role: 'assistant',
          content: result.reply,
          createdAt: new Date().toISOString(),
          suggestions: result.suggestions,
        },
      });
    } catch (error) {
      dispatch({
        type: 'ADD_COMPANION_MESSAGE',
        message: {
          id: uid('msg'),
          role: 'assistant',
          content: describeAiError(error),
          createdAt: new Date().toISOString(),
          isError: true,
        },
      });
    } finally {
      setSending(false);
    }
  };

  const prompts = [
    'What should I work on next?',
    'I have several deadlines and have not started. Where do I begin?',
    'Help me plan the rest of today realistically.',
    'Which project needs attention this week?',
  ];

  const nextTask = stats.nextTask;
  const nextProject = nextTask
    ? state.projects.find((project) => project.id === nextTask.projectId)
    : null;
  const upcoming = stats.upcomingDeadlines.slice(0, 3);

  return (
    <div>
      <PageHeader
        index="05"
        jp="案内"
        title="AI companion"
        description="A calm, context-aware assistant. It can read your real workspace and suggest next steps; it cannot change tasks or award XP."
        actions={
          <>
            {state.companionMessages.length > 0 ? (
              <Button variant="ghost" onClick={() => setClearOpen(true)}>
                <Trash2 size={12} aria-hidden />
                Clear
              </Button>
            ) : null}
            {aiReady ? (
              <span className="inline-flex items-center gap-1.5 border border-line px-2 py-1.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-muted">
                <span className="h-1 w-1 rounded-full bg-sage" aria-hidden />
                {state.settings.ai.model}
              </span>
            ) : (
              <Link
                to="/settings#ai"
                className="inline-flex items-center gap-1.5 border border-accent/40 px-2 py-1.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-accent"
              >
                AI not configured
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="flex h-[calc(100dvh-280px)] min-h-[500px] max-h-[760px] flex-col border border-line bg-paper">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
            <span className="eyebrow">Conversation · 対話</span>
            <span className="font-mono text-[8.5px] uppercase tracking-[0.08em] text-muted">
              {state.companionMessages.length} message{state.companionMessages.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="scroll-thin flex-1 overflow-y-auto px-4 py-5 sm:px-5">
            {state.companionMessages.length === 0 ? (
              <div className="mx-auto max-w-md py-4 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center border border-accent font-serif text-[22px] text-accent">
                  歩
                </span>
                <h2 className="mt-4 text-[22px] leading-snug">A calm place to think out loud.</h2>
                <p className="mx-auto mt-2 max-w-sm text-[12px] leading-6 text-muted">
                  The companion reads only what is in this workspace: your projects, tasks,
                  deadlines, focus history and streak. Ask it what to do next, or how to recover
                  when everything feels behind.
                </p>
                {!aiReady ? (
                  <div className="mt-5 border border-line bg-surface2/40 px-4 py-3 text-left">
                    <p className="text-[12px] font-medium text-ink">Connect OpenRouter to chat</p>
                    <p className="mt-1 text-[11px] leading-5 text-muted">
                      Add your own API key in Settings. Nothing is sent until you write a message.
                    </p>
                    <Link
                      to="/settings#ai"
                      className="mt-2 inline-flex items-center gap-1 text-[11px] text-accent underline decoration-accent/40 underline-offset-2"
                    >
                      Open AI settings <ArrowRight size={11} aria-hidden />
                    </Link>
                  </div>
                ) : (
                  <div className="mt-5 grid gap-2 text-left">
                    {prompts.slice(0, 3).map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void send(prompt)}
                        className="group flex items-center justify-between gap-3 border border-line px-3 py-2.5 text-left text-[11.5px] text-ink/80 transition-colors hover:border-ink/25 hover:bg-surface2/40"
                      >
                        {prompt}
                        <ArrowRight
                          size={12}
                          className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                          aria-hidden
                        />
                      </button>
                    ))}
                  </div>
                )}
                {state.projects.length === 0 && state.tasks.length === 0 ? (
                  <InlineNote className="mt-4 text-left">
                    There is not much to work with yet. Add a task or project and the companion
                    will have something real to reason about.
                  </InlineNote>
                ) : null}
              </div>
            ) : (
              <ol className="space-y-5">
                {state.companionMessages.map((message) =>
                  message.role === 'user' ? (
                    <li key={message.id} className="flex justify-end">
                      <div className="max-w-[88%] border border-line bg-surface2/55 px-3.5 py-2.5 sm:max-w-[75%]">
                        <p className="whitespace-pre-wrap text-[12.5px] leading-6 text-ink">
                          {message.content}
                        </p>
                        <p className="mt-1 text-right font-mono text-[8px] uppercase tracking-[0.06em] text-muted">
                          {formatTime(message.createdAt)}
                        </p>
                      </div>
                    </li>
                  ) : (
                    <li key={message.id} className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border font-serif text-[13px]',
                          message.isError
                            ? 'border-accent/50 text-accent'
                            : 'border-line text-accent',
                        )}
                      >
                        歩
                      </span>
                      <div className="min-w-0 max-w-[92%]">
                        <p
                          className={cn(
                            'whitespace-pre-wrap text-[12.5px] leading-6',
                            message.isError ? 'text-accent' : 'text-ink/90',
                          )}
                        >
                          {message.content}
                        </p>
                        {message.suggestions && message.suggestions.length > 0 && !message.isError ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {message.suggestions.map((suggestion, index) => (
                              <button
                                key={`${suggestion.label}-${index}`}
                                type="button"
                                onClick={() => void send(suggestion.label)}
                                disabled={sending}
                                className="border border-line px-2 py-1 text-left text-[10.5px] text-muted transition-colors hover:border-accent/40 hover:text-ink disabled:opacity-50"
                              >
                                {suggestion.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.06em] text-muted">
                          {humanRelative(message.createdAt)}
                        </p>
                      </div>
                    </li>
                  ),
                )}
                {sending ? (
                  <li className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-line font-serif text-[13px] text-accent">
                      歩
                    </span>
                    <span className="inline-flex items-center gap-2 text-[11.5px] text-muted">
                      <Spinner className="h-3.5 w-3.5" />
                      Thinking with your real tasks…
                    </span>
                  </li>
                ) : null}
              </ol>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-line p-3">
            <label htmlFor="companion-input" className="sr-only">
              Message the AI companion
            </label>
            <Textarea
              id="companion-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void send(input);
                }
              }}
              rows={2}
              maxLength={1200}
              placeholder={
                aiReady
                  ? 'Ask about your work… (Enter to send, Shift+Enter for a new line)'
                  : 'Add an OpenRouter API key to talk to the companion.'
              }
              disabled={!aiReady || sending}
              className="min-h-[54px] resize-none border-0 bg-transparent px-1 focus:shadow-none"
            />
            <div className="mt-1.5 flex items-center justify-between gap-3 border-t border-line pt-2">
              <p className="text-[9.5px] leading-4 text-muted">
                Suggestions only. No task changes without your action.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void send(input)}
                disabled={!aiReady || sending || input.trim().length === 0}
              >
                {sending ? <Spinner className="border-paper/40 border-t-paper" /> : <Send size={12} aria-hidden />}
                Send
              </Button>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="border border-line bg-paper p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow">Context · 文脈</p>
                <h2 className="mt-0.5 text-[15px]">What the companion can see</h2>
              </div>
              <MessageCircle size={15} className="text-muted" aria-hidden />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-px border border-line bg-line">
              {[
                { label: 'Projects', value: state.projects.length },
                { label: 'Open tasks', value: stats.openTasks.length },
                { label: 'Due today', value: stats.todayProgress.total },
                { label: 'Overdue', value: stats.overdueTasks.length },
              ].map((item) => (
                <div key={item.label} className="bg-paper px-3 py-2">
                  <p className="eyebrow mb-0.5">{item.label}</p>
                  <p className="font-mono text-[15px] text-ink">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 font-mono text-[9px] leading-5 text-muted">
              <p>Focus today · {stats.todayFocusMinutes} min</p>
              <p>Focus this week · {stats.weekFocusMinutes} min</p>
              <p>Streak · {state.streak.currentStreak} days</p>
            </div>
            {upcoming.length > 0 ? (
              <div className="mt-3 border-t border-line pt-2.5">
                <p className="eyebrow mb-1.5">Nearest deadlines</p>
                <ul className="space-y-1.5">
                  {upcoming.map((task) => (
                    <li key={task.id} className="text-[10.5px] leading-4 text-ink/80">
                      <span className="block truncate">{task.title}</span>
                      <span className="font-mono text-[8.5px] text-muted">
                        {formatDateKey(toDateKey(task.deadline as string), {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="mt-3 border-t border-line pt-2.5 text-[9.5px] leading-4 text-muted">
              Only the summary above is sent. Your full data never leaves this device apart from
              that context when you send a message.
            </p>
          </section>

          {nextTask ? (
            <section className="border border-line bg-paper p-4">
              <p className="eyebrow">Next step · app logic</p>
              <h2 className="mt-0.5 text-[14px] leading-snug">{nextTask.title}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <PriorityBadge priority={nextTask.priority} />
                <span className="font-mono text-[9px] text-muted">
                  {nextTask.estimatedMinutes} min
                </span>
              </div>
              {nextProject ? (
                <p className="mt-1.5 font-mono text-[8.5px] uppercase tracking-[0.08em] text-muted">
                  {nextProject.title}
                </p>
              ) : null}
              <p className="mt-2 text-[10.5px] leading-5 text-muted">
                Chosen locally from deadlines, priority and today&apos;s schedule. Not an AI
                recommendation.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to={`/focus?task=${nextTask.id}`}
                  className="inline-flex h-8 items-center gap-1.5 border border-accent bg-accent px-3 text-[11px] text-paper"
                >
                  <Timer size={11} aria-hidden />
                  Start focus
                </Link>
                <Button variant="ghost" size="sm" onClick={() => openTask({ taskId: nextTask.id })}>
                  Open task
                </Button>
              </div>
            </section>
          ) : null}

          <section className="border border-line bg-paper p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-sage" aria-hidden />
              <h2 className="text-[13px]">What it will not do</h2>
            </div>
            <ul className="mt-2 space-y-1.5 text-[10.5px] leading-5 text-muted">
              <li>· Invent tasks, deadlines, progress or history.</li>
              <li>· Mark anything complete or award XP.</li>
              <li>· Change a project without a confirmation interface.</li>
              <li>· Claim to have found resources it cannot access.</li>
            </ul>
            <p className="mt-2 border-t border-line pt-2 text-[9.5px] leading-4 text-muted">
              <Sparkles size={10} className="mr-1 inline" aria-hidden />
              Powered by your own OpenRouter key, stored in this browser only.
            </p>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={() => {
          dispatch({ type: 'CLEAR_COMPANION' });
          setClearOpen(false);
          toast({ title: 'Conversation cleared', description: 'Only the chat was removed. Tasks and XP are untouched.', duration: 3000 });
        }}
        title="Clear this conversation?"
        description="The chat history will be removed from this device. Your tasks, projects, focus history and XP are not affected."
        confirmLabel="Clear conversation"
        tone="danger"
      />
    </div>
  );
}
