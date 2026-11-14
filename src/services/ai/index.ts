import { z } from 'zod';
import type {
  CompanionSuggestion,
  DailyPlan,
  FeedbackType,
  PlanBlock,
  Priority,
  Task,
  TaskDraft,
  Task as TaskModel,
} from '../../types';
import { AiError, requestStructured, type AiConfig } from './client';
import { isoFromDateAndTime, todayKey } from '../../utils/date';
import { uid } from '../../utils/id';

const taskDraftSchema = z.object({
  key: z.string().min(1).max(40).optional(),
  title: z.string().min(2).max(180),
  description: z.string().max(500).default(''),
  estimatedMinutes: z.number().int().min(5).max(240),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  dependsOn: z.array(z.string().min(1).max(60)).max(8).default([]),
});

const decompositionSchema = z.object({
  projectTitle: z.string().min(2).max(140),
  projectDescription: z.string().max(400).default(''),
  reasoning: z.string().max(600).default(''),
  phases: z
    .array(
      z.object({
        title: z.string().min(2).max(120),
        tasks: z.array(taskDraftSchema).min(1).max(7),
      }),
    )
    .min(2)
    .max(6),
});

const adaptationSchema = z.object({
  reasoning: z.string().min(2).max(700),
  strategy: z.enum(['break_down', 'reframe', 'shorter_sessions', 'resources', 'sequence']),
  subtasks: z.array(taskDraftSchema).max(8),
  revisedEstimateMinutes: z.number().int().min(5).max(600).optional(),
  suggestedFocusMinutes: z.number().int().min(5).max(90).optional(),
  reframedTask: z
    .object({
      title: z.string().min(2).max(180),
      description: z.string().max(600),
    })
    .optional(),
});

const planSchema = z.object({
  summary: z.string().max(500),
  blocks: z
    .array(
      z.object({
        kind: z.enum(['focus', 'break', 'longBreak']),
        start: z.string().regex(/^\d{2}:\d{2}$/),
        end: z.string().regex(/^\d{2}:\d{2}$/),
        taskId: z.string().nullable(),
        label: z.string().max(160),
      }),
    )
    .max(20),
});

const recommendationSchema = z.object({
  taskId: z.string(),
  reason: z.string().min(2).max(600),
  firstStep: z.string().min(2).max(240),
  suggestedMinutes: z.number().int().min(5).max(120),
});

const companionSchema = z.object({
  reply: z.string().min(2).max(2000),
  suggestions: z
    .array(
      z.object({
        label: z.string().min(1).max(80),
        taskId: z.string().optional(),
      }),
    )
    .max(3)
    .default([]),
});

const estimateSchema = z.object({
  estimatedMinutes: z.number().int().min(5).max(600),
  reasoning: z.string().max(500),
  confidence: z.enum(['low', 'medium', 'high']),
});

const BASE_SYSTEM = `You are the calm, practical planning intelligence inside TakTic, a productivity workspace for students who find large work hard to begin and organise.
Principles:
- Be concise, concrete and non-judgemental. No motivational speeches. No emojis. No exclamation marks beyond one if truly natural.
- Prefer small, immediately actionable steps over abstract advice.
- Never invent tasks, deadlines, statistics, user history, achievements, resources or progress. Use only the data supplied in the request.
- Never claim to have browsed, found or verified a resource. If a resource is needed, say what kind to look for instead.
- Do not mention diagnoses, medical labels or clinical advice.
- Students often struggle with task initiation and overwhelm: offer structure, not pressure.
- Keep language plain, British-neutral English.
Only answer with the JSON shape requested by the user.`;

function formatDeadline(deadline: string | null): string {
  if (!deadline) return 'no deadline';
  return new Date(deadline).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function taskLine(task: Task): string {
  const bits = [
    `id=${task.id}`,
    `"${task.title}"`,
    `priority=${task.priority}`,
    `estimate=${task.estimatedMinutes}min`,
    `difficulty=${task.difficulty}`,
    `status=${task.status}`,
    task.deadline ? `deadline=${formatDeadline(task.deadline)}` : 'no deadline',
  ];
  if (task.dependencies.length > 0) bits.push(`depends-on=${task.dependencies.join(',')}`);
  return `- ${bits.join(' | ')}`;
}

export interface DecompositionResult {
  projectTitle: string;
  projectDescription: string;
  reasoning: string;
  phases: Array<{ title: string; tasks: TaskDraft[] }>;
}

export async function decomposeTask(input: {
  goal: string;
  description?: string;
  deadline?: string | null;
  availableMinutesPerDay?: number;
  config: AiConfig;
}): Promise<DecompositionResult> {
  const result = await requestStructured<z.infer<typeof decompositionSchema>>({
    config: input.config,
    schema: decompositionSchema,
    system: BASE_SYSTEM,
    temperature: 0.3,
    maxTokens: 1800,
    user: `Break the following large piece of student work into a realistic hierarchy.

Goal: ${input.goal}
Extra context: ${input.description ?? 'none'}
Deadline: ${input.deadline ? formatDeadline(input.deadline) : 'none supplied'}
Typical available working time: ${input.availableMinutesPerDay ?? 90} minutes per day

Rules:
- 3 to 6 phases. Each phase has 2 to 6 actionable sub-tasks.
- Sub-tasks must be things a student can start without further planning, and must be small enough to fit in one sitting (5–90 minutes).
- Do not create placeholder tasks like "work on it" or "try harder".
- Do not add time off, celebrations or invented resources.
- Priority and execution order are different. The final deliverable can be urgent, but it must wait for research, planning, drafting and review.
- Give every task a short unique key such as "research" or "outline" and list the keys that must finish first in "dependsOn". A task with no prerequisites has an empty list.
- Dependencies must be acyclic. Never make a task depend on itself or on a task that comes after it in a loop.
- Prefer dependencies within the same phase, but a later phase may depend on an earlier one. Independent tasks may run in parallel.
- Include a short, factual reasoning explaining the shape of the plan.

Return JSON:
{"projectTitle": string, "projectDescription": string, "reasoning": string, "phases": [{"title": string, "tasks": [{"key": string, "title": string, "description": string, "estimatedMinutes": number, "difficulty": "easy"|"medium"|"hard", "priority": "low"|"medium"|"high"|"urgent", "dependsOn": string[]}]}]}`,
  });

  return {
    projectTitle: result.projectTitle.trim(),
    projectDescription: result.projectDescription.trim(),
    reasoning: result.reasoning.trim(),
    phases: result.phases.map((phase) => ({
      title: phase.title.trim(),
      tasks: phase.tasks.map((draft) => ({
        key: draft.key?.trim(),
        title: draft.title.trim(),
        description: draft.description.trim(),
        estimatedMinutes: Math.round(draft.estimatedMinutes),
        difficulty: draft.difficulty,
        priority: draft.priority ?? 'medium',
        dependsOn: draft.dependsOn.map((key) => key.trim()).filter(Boolean),
      })),
    })),
  };
}

export interface AdaptationResult {
  reasoning: string;
  strategy: string;
  subtasks: TaskDraft[];
  revisedEstimateMinutes?: number;
  suggestedFocusMinutes?: number;
  reframedTask?: { title: string; description: string };
}

export async function adaptTask(input: {
  task: Task;
  projectTitle: string;
  feedback: FeedbackType;
  explanation: string;
  completedSubtasks: string[];
  recentSessions: Array<{ plannedSeconds: number; actualSeconds: number }>;
  config: AiConfig;
}): Promise<AdaptationResult> {
  const feedbackLabels: Record<FeedbackType, string> = {
    understand: "I don't understand the topic.",
    start: "I don't know where to start.",
    too_big: 'This task feels too big.',
    concentration: "I'm struggling to concentrate.",
    time: 'The estimated time is unrealistic.',
    resources: "I don't have the resources I need.",
    other: 'Something else.',
  };

  const result = await requestStructured<z.infer<typeof adaptationSchema>>({
    config: input.config,
    schema: adaptationSchema,
    system: BASE_SYSTEM,
    temperature: 0.4,
    maxTokens: 1500,
    user: `A student is stuck on one task. Adapt the task instead of simply asking them to try harder.

Task: "${input.task.title}"
Description: ${input.task.description || 'none'}
Project: ${input.projectTitle}
Current estimate: ${input.task.estimatedMinutes} minutes
Difficulty: ${input.task.difficulty}
Already completed sub-tasks that MUST be preserved: ${input.completedSubtasks.join('; ') || 'none'}
Recent focus sessions on this task: ${
      input.recentSessions.length > 0
        ? input.recentSessions
            .map((session) => `${Math.round(session.actualSeconds / 60)} of ${Math.round(session.plannedSeconds / 60)} min`)
            .join(', ')
        : 'none'
    }

Feedback: ${feedbackLabels[input.feedback]}
${
  input.feedback === 'time'
    ? 'If the direction of the mis-estimate is not stated in the explanation, do not assume whether it was too short or too long; choose a cautious revised estimate and explain the assumption briefly.'
    : ''
}
${input.explanation ? `Additional explanation from the student: ${input.explanation}` : ''}

Rules:
- Generate 3 to 7 subtasks that can each be started immediately. Do not use placeholders.
- Preserve the original task as the parent; do not try to replace completed work.
- If the task feels conceptually hard, build understanding first (definitions, one concrete example, then explanation).
- If starting is the problem, make the first step almost trivially small.
- If it feels too big, split into a visible sequence with a clear stopping point.
- If concentration is the issue, suggest a shorter focus length and lower-friction actions.
- If time is unrealistic, recalculate the estimate. If resources are missing, break down how to obtain them and suggest alternatives without inventing anything.
- Explain briefly why this change should help. Never claim resources have been found.
- Do not add more than 7 subtasks. Prefer fewer, clearer ones.

Return JSON:
{"reasoning": string, "strategy": "break_down"|"reframe"|"shorter_sessions"|"resources"|"sequence", "subtasks": [{"title": string, "description": string, "estimatedMinutes": number, "difficulty": "easy"|"medium"|"hard"}], "revisedEstimateMinutes": number?, "suggestedFocusMinutes": number?, "reframedTask": {"title": string, "description": string}?}`,
  });

  return {
    reasoning: result.reasoning.trim(),
    strategy: result.strategy,
    subtasks: result.subtasks.map((subtask) => ({
      title: subtask.title.trim(),
      description: subtask.description.trim(),
      estimatedMinutes: Math.round(subtask.estimatedMinutes),
      difficulty: subtask.difficulty,
    })),
    revisedEstimateMinutes: result.revisedEstimateMinutes,
    suggestedFocusMinutes: result.suggestedFocusMinutes,
    reframedTask: result.reframedTask
      ? {
          title: result.reframedTask.title.trim(),
          description: result.reframedTask.description.trim(),
        }
      : undefined,
  };
}

export async function generateDailyPlan(input: {
  tasks: Task[];
  availableMinutes: number;
  startHour: number;
  focusMinutes: number;
  config: AiConfig;
  date?: string;
}): Promise<Omit<DailyPlan, 'id' | 'createdAt'>> {
  const date = input.date ?? todayKey();
  if (input.tasks.length === 0) {
    throw new AiError('invalid-response', 'There are no open tasks to plan.');
  }
  const result = await requestStructured<z.infer<typeof planSchema>>({
    config: input.config,
    schema: planSchema,
    system: BASE_SYSTEM,
    temperature: 0.25,
    maxTokens: 1400,
    user: `Build a realistic study plan for today.

Date: ${date}
Available working time: ${input.availableMinutes} minutes, starting at ${String(input.startHour).padStart(2, '0')}:00
Preferred focus block: ${input.focusMinutes} minutes
Open tasks (use ONLY these ids):
${input.tasks.map(taskLine).join('\n')}

Rules:
- Do not exceed the available working time. Never overbook.
- Include a short 5-minute break between focus blocks and a longer break after roughly two hours; set kind to "longBreak" for breaks of 10+ minutes.
- Prioritise near deadlines and high priority, respect dependencies, and do not schedule a task whose dependencies are not yet complete.
- Each focus block must reference one real task id from the list. Do not invent tasks or ids.
- A focus block may be shorter than the preferred length when the task estimate is short.
- Leave a short buffer rather than filling every minute.
- The summary should be one or two factual sentences about the shape of the day. No motivational language.

Return JSON:
{"summary": string, "blocks": [{"kind": "focus"|"break"|"longBreak", "start": "HH:MM", "end": "HH:MM", "taskId": string|null, "label": string}]}`,
  });

  const validTaskIds = new Set(input.tasks.map((task) => task.id));
  const blocks: PlanBlock[] = [];
  for (const block of result.blocks) {
    const [startHourPart, startMinutePart] = block.start.split(':').map(Number);
    const [endHourPart, endMinutePart] = block.end.split(':').map(Number);
    if (
      [startHourPart, startMinutePart, endHourPart, endMinutePart].some(
        (value) => !Number.isFinite(value),
      )
    ) {
      continue;
    }
    const minutes = endHourPart * 60 + endMinutePart - (startHourPart * 60 + startMinutePart);
    if (minutes <= 0 || minutes > 180) continue;
    const taskId =
      block.taskId && validTaskIds.has(block.taskId) ? block.taskId : null;
    if (block.kind === 'focus' && !taskId) continue;
    blocks.push({
      id: uid('block'),
      kind: block.kind,
      start: isoFromDateAndTime(date, block.start),
      end: isoFromDateAndTime(date, block.end),
      taskId,
      label: taskId
        ? input.tasks.find((task) => task.id === taskId)?.title ?? block.label
        : block.label || (block.kind === 'longBreak' ? 'Long break' : 'Short break'),
      minutes,
    });
  }
  blocks.sort((a, b) => a.start.localeCompare(b.start));
  if (blocks.length === 0) {
    throw new AiError('invalid-response', 'The AI did not return a usable schedule. Try again.');
  }
  const totalFocus = blocks
    .filter((block) => block.kind === 'focus')
    .reduce((sum, block) => sum + block.minutes, 0);
  if (totalFocus <= 0) {
    throw new AiError('invalid-response', 'The plan contained no focus time.');
  }

  return {
    date,
    startTime: `${String(input.startHour).padStart(2, '0')}:00`,
    availableMinutes: input.availableMinutes,
    blocks,
    summary: result.summary.trim(),
    source: 'ai',
  };
}

export interface RecommendationResult {
  taskId: string;
  reason: string;
  firstStep: string;
  suggestedMinutes: number;
}

export async function recommendNextTask(input: {
  tasks: Task[];
  projects: Array<{ id: string; title: string; progress: number }>;
  config: AiConfig;
}): Promise<RecommendationResult> {
  if (input.tasks.length === 0) {
    throw new AiError('invalid-response', 'There are no open tasks to recommend.');
  }
  const result = await requestStructured<z.infer<typeof recommendationSchema>>({
    config: input.config,
    schema: recommendationSchema,
    system: BASE_SYSTEM,
    temperature: 0.15,
    maxTokens: 600,
    user: `Choose the single best task to work on next.

Open actionable tasks:
${input.tasks.map(taskLine).join('\n')}

Projects and completion:
${input.projects.map((project) => `- ${project.title} (${project.progress}% complete)`).join('\n') || '- none'}

Rules:
- Pick one task id from the list. Never invent an id.
- Weigh deadline proximity, priority, dependencies and a realistic 25–45 minute session.
- Do not pick a blocked task if another reasonable option exists.
- The reason must refer only to the supplied data. The firstStep must be a genuinely small physical or mental action that begins the task.

Return JSON:
{"taskId": string, "reason": string, "firstStep": string, "suggestedMinutes": number}`,
  });

  if (!input.tasks.some((task) => task.id === result.taskId)) {
    throw new AiError('invalid-response', 'The recommendation referenced a task that is not open.');
  }
  return {
    taskId: result.taskId,
    reason: result.reason.trim(),
    firstStep: result.firstStep.trim(),
    suggestedMinutes: Math.round(result.suggestedMinutes),
  };
}

export interface CompanionResult {
  reply: string;
  suggestions: CompanionSuggestion[];
}

export async function generateCompanionResponse(input: {
  message: string;
  context: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  style: 'concise' | 'warm' | 'direct';
  config: AiConfig;
}): Promise<CompanionResult> {
  const styles = {
    concise: 'Answer in 2 to 4 short sentences. Get to the useful part immediately.',
    warm: 'Be warm but restrained: at most 5 sentences, no platitudes.',
    direct: 'Be direct and practical, like a calm tutor. At most 4 sentences.',
  } as const;

  const result = await requestStructured<z.infer<typeof companionSchema>>({
    config: input.config,
    schema: companionSchema,
    system: `${BASE_SYSTEM}\nStyle: ${styles[input.style]}`,
    temperature: 0.6,
    maxTokens: 900,
    user: `You are the TakTic companion. Use this real workspace context, nothing else:
${input.context}

Recent conversation (oldest first):
${input.history.length > 0 ? input.history.map((message) => `${message.role}: ${message.content}`).join('\n') : '(new conversation)'}

Student: ${input.message}

Rules:
- Recommend concrete next steps based only on the real tasks and data above.
- If they are behind, help them choose what to drop or defer, rather than listing everything.
- If they ask what to do next, name a real task. If they are overwhelmed, reduce the options to one starting action.
- If the data does not contain the answer, say so plainly instead of guessing.
- Never claim to have changed any task, deadline or XP. Suggest actions only.
- Suggestions are optional short buttons; only attach a taskId when it appears in the context.

Return JSON:
{"reply": string, "suggestions": [{"label": string, "taskId": string}]}`,
  });

  return {
    reply: result.reply.trim(),
    suggestions: result.suggestions.filter(
      (suggestion) => suggestion.label.trim().length > 0,
    ),
  };
}

export async function estimateTaskDuration(input: {
  title: string;
  description: string;
  projectTitle: string;
  history: Array<{ title: string; estimated: number; actual: number }>;
  config: AiConfig;
}): Promise<{ estimatedMinutes: number; reasoning: string; confidence: 'low' | 'medium' | 'high' }> {
  const result = await requestStructured<z.infer<typeof estimateSchema>>({
    config: input.config,
    schema: estimateSchema,
    system: BASE_SYSTEM,
    temperature: 0.25,
    maxTokens: 500,
    user: `Estimate how long this student task will realistically take.

Task: "${input.title}"
Description: ${input.description || 'none'}
Project: ${input.projectTitle}
Their recent completed tasks (estimate vs actual minutes):
${input.history.length > 0 ? input.history.map((item) => `- "${item.title}": ${item.estimated} planned, ${item.actual} actual`).join('\n') : '- no history yet'}

Rules:
- Give one number of minutes. Account for their actual history if it suggests a consistent bias, but do not assume all tasks should become easier.
- Do not offer several options. Choose a defensible middle estimate.
- State the reasoning in one sentence and a confidence level.

Return JSON:
{"estimatedMinutes": number, "reasoning": string, "confidence": "low"|"medium"|"high"}`,
  });
  return {
    estimatedMinutes: Math.round(result.estimatedMinutes),
    reasoning: result.reasoning.trim(),
    confidence: result.confidence,
  };
}

export function buildPlanFromRule(input: {
  tasks: Task[];
  availableMinutes: number;
  startHour: number;
  focusMinutes: number;
  date?: string;
}): Omit<DailyPlan, 'id' | 'createdAt'> {
  const date = input.date ?? todayKey();
  const blocks: PlanBlock[] = [];
  let cursor = input.startHour * 60;
  const limit = cursor + input.availableMinutes;
  let focusRun = 0;
  const queue = [...input.tasks].sort((a, b) => {
    const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
    const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
    const priorityRank: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    return priorityRank[a.priority] - priorityRank[b.priority] || aDeadline - bDeadline;
  });

  for (const task of queue) {
    const length = Math.min(input.focusMinutes, Math.max(10, task.estimatedMinutes));
    if (cursor + length > limit) break;
    const start = cursor;
    const end = start + length;
    blocks.push({
      id: uid('block'),
      kind: 'focus',
      start: isoFromDateAndTime(date, `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`),
      end: isoFromDateAndTime(date, `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`),
      taskId: task.id,
      label: task.title,
      minutes: length,
    });
    cursor = end;
    focusRun += 1;
    if (focusRun % 4 === 0 && cursor + 15 <= limit) {
      blocks.push({
        id: uid('block'),
        kind: 'longBreak',
        start: isoFromDateAndTime(date, `${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`),
        end: isoFromDateAndTime(date, `${String(Math.floor((cursor + 15) / 60)).padStart(2, '0')}:${String((cursor + 15) % 60).padStart(2, '0')}`),
        taskId: null,
        label: 'Long break',
        minutes: 15,
      });
      cursor += 15;
    } else if (cursor + 5 <= limit) {
      blocks.push({
        id: uid('block'),
        kind: 'break',
        start: isoFromDateAndTime(date, `${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`),
        end: isoFromDateAndTime(date, `${String(Math.floor((cursor + 5) / 60)).padStart(2, '0')}:${String((cursor + 5) % 60).padStart(2, '0')}`),
        taskId: null,
        label: 'Short break',
        minutes: 5,
      });
      cursor += 5;
    }
  }

  return {
    date,
    startTime: `${String(input.startHour).padStart(2, '0')}:00`,
    availableMinutes: input.availableMinutes,
    blocks,
    summary:
      blocks.length === 0
        ? 'Not enough open time for the current task estimates. Reduce scope or extend the session.'
        : `${blocks.filter((block) => block.kind === 'focus').length} focus blocks built from task priority and deadlines.`,
    source: 'rule-based',
  };
}

export type { TaskModel };
