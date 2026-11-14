import type {
  AchievementUnlock,
  ActivityDay,
  CompanionMessage,
  FocusSession,
  Project,
  TakTicState,
  Task,
  XpTransaction,
} from '../types';
import { createInitialState } from './initialState';
import { ACHIEVEMENTS } from '../services/gamification/achievements';
import { buildProject, buildTask } from '../utils/factories';
import { DEFAULT_XP, levelInfo } from '../services/gamification/xp';
import {
  computeCurrentStreak,
  computeLongestStreak,
} from '../services/gamification/streak';
import { generateObjectives, refreshObjectives } from '../services/gamification/objectives';
import { syncChildLinks } from '../services/storage/repair';
import { toDateKey, todayKey } from '../utils/date';

function at(daysAgo: number, hour: number, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function dueIn(days: number, hour = 23, minute = 59): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

/**
 * A coherent demo workspace built from the same event rules as real play:
 * completed leaves, focus sessions, streaks and the XP ledger all agree.
 */
export function createDemoState(): TakTicState {
  const base = createInitialState();
  const today = todayKey();

  const projects: Project[] = [
    {
      ...buildProject({
        id: 'demo-proj-bio',
        title: 'Biology Research Assignment — The Human Immune System',
        description:
          'A 2,000-word research assignment covering innate and adaptive immunity, with a full reference list.',
        deadline: dueIn(8),
        priority: 'high',
        createdAt: at(12, 9),
      }),
      isDemo: true,
    },
    {
      ...buildProject({
        id: 'demo-proj-chem',
        title: 'Chemistry Revision — Organic Mechanisms',
        description: 'Consolidate class notes and work through past-paper questions before the unit test.',
        deadline: dueIn(5),
        priority: 'medium',
        createdAt: at(10, 14),
      }),
      isDemo: true,
    },
    {
      ...buildProject({
        id: 'demo-proj-math',
        title: 'Mathematics Olympiad Practice',
        description: 'One focused problem a day, with a written review of the approach.',
        deadline: dueIn(1),
        priority: 'urgent',
        createdAt: at(8, 16),
      }),
      isDemo: true,
    },
    {
      ...buildProject({
        id: 'demo-proj-english',
        title: 'English Literature Essay — Macbeth',
        description:
          'A close-reading essay on ambition and guilt, built from quotations and a clear argument.',
        deadline: dueIn(6),
        priority: 'high',
        createdAt: at(9, 11),
      }),
      isDemo: true,
    },
    {
      ...buildProject({
        id: 'demo-proj-space',
        title: 'Study Space Reset',
        description: 'A small project to make the desk easier to sit down at.',
        deadline: at(3, 18),
        priority: 'low',
        createdAt: at(13, 10),
        status: 'completed',
        completedAt: at(3, 19),
      }),
      isDemo: true,
    },
  ];

  const tasks: Task[] = [
    buildTask({
      id: 'demo-bio-req',
      projectId: 'demo-proj-bio',
      title: 'Understand assignment requirements',
      description: 'Before research, make sure the brief and marking criteria are completely clear.',
      estimatedMinutes: 35,
      difficulty: 'easy',
      priority: 'high',
      deadline: dueIn(8),
      createdAt: at(12, 9, 10),
      order: 10,
    }),
    buildTask({
      id: 'demo-bio-brief',
      projectId: 'demo-proj-bio',
      parentTaskId: 'demo-bio-req',
      title: 'Read assignment brief',
      estimatedMinutes: 15,
      difficulty: 'easy',
      priority: 'medium',
      order: 11,
      createdAt: at(12, 9, 12),
    }),
    buildTask({
      id: 'demo-bio-sections',
      projectId: 'demo-proj-bio',
      parentTaskId: 'demo-bio-req',
      title: 'Identify required sections',
      estimatedMinutes: 10,
      difficulty: 'easy',
      priority: 'medium',
      order: 12,
      createdAt: at(12, 9, 14),
    }),
    buildTask({
      id: 'demo-bio-marking',
      projectId: 'demo-proj-bio',
      parentTaskId: 'demo-bio-req',
      title: 'Identify marking criteria',
      estimatedMinutes: 10,
      difficulty: 'easy',
      priority: 'high',
      order: 13,
      createdAt: at(12, 9, 16),
    }),
    buildTask({
      id: 'demo-bio-research',
      projectId: 'demo-proj-bio',
      title: 'Research the immune system',
      description: 'Collect accurate notes on innate immunity, adaptive immunity and antibody production.',
      estimatedMinutes: 145,
      difficulty: 'medium',
      priority: 'high',
      deadline: dueIn(3),
      createdAt: at(12, 10),
      order: 20,
    }),
    buildTask({
      id: 'demo-bio-innate',
      projectId: 'demo-proj-bio',
      parentTaskId: 'demo-bio-research',
      title: 'Understand innate immunity',
      estimatedMinutes: 30,
      difficulty: 'medium',
      priority: 'high',
      order: 21,
      createdAt: at(12, 10, 5),
    }),
    buildTask({
      id: 'demo-bio-adaptive',
      projectId: 'demo-proj-bio',
      parentTaskId: 'demo-bio-research',
      title: 'Research adaptive immunity',
      description: 'The section I keep avoiding. It still feels abstract.',
      estimatedMinutes: 45,
      difficulty: 'medium',
      priority: 'high',
      deadline: dueIn(3),
      scheduledDate: today,
      dependencies: ['demo-bio-innate'],
      order: 22,
      createdAt: at(12, 10, 10),
    }),
    buildTask({
      id: 'demo-bio-bcells',
      projectId: 'demo-proj-bio',
      parentTaskId: 'demo-bio-research',
      title: 'Understand B lymphocytes',
      estimatedMinutes: 25,
      difficulty: 'medium',
      priority: 'medium',
      dependencies: ['demo-bio-adaptive'],
      order: 23,
      createdAt: at(12, 10, 15),
    }),
    buildTask({
      id: 'demo-bio-tcells',
      projectId: 'demo-proj-bio',
      parentTaskId: 'demo-bio-research',
      title: 'Understand T lymphocytes',
      estimatedMinutes: 25,
      difficulty: 'medium',
      priority: 'medium',
      scheduledDate: today,
      dependencies: ['demo-bio-adaptive'],
      order: 24,
      createdAt: at(12, 10, 20),
    }),
    buildTask({
      id: 'demo-bio-antibody',
      projectId: 'demo-proj-bio',
      parentTaskId: 'demo-bio-research',
      title: 'Research antibody production',
      estimatedMinutes: 20,
      difficulty: 'easy',
      priority: 'medium',
      scheduledDate: today,
      order: 25,
      createdAt: at(12, 10, 25),
    }),
    buildTask({
      id: 'demo-bio-organise',
      projectId: 'demo-proj-bio',
      title: 'Organise research',
      description: 'Turn scattered notes into a clear structure before writing.',
      estimatedMinutes: 70,
      difficulty: 'medium',
      priority: 'medium',
      createdAt: at(12, 11),
      order: 30,
    }),
    buildTask({
      id: 'demo-bio-sources',
      projectId: 'demo-proj-bio',
      parentTaskId: 'demo-bio-organise',
      title: 'Collect reliable sources',
      estimatedMinutes: 20,
      difficulty: 'easy',
      priority: 'medium',
      scheduledDate: today,
      order: 31,
      createdAt: at(12, 11, 5),
    }),
    buildTask({
      id: 'demo-bio-extract',
      projectId: 'demo-proj-bio',
      parentTaskId: 'demo-bio-organise',
      title: 'Extract relevant information',
      estimatedMinutes: 30,
      difficulty: 'medium',
      priority: 'medium',
      scheduledDate: today,
      order: 32,
      createdAt: at(12, 11, 10),
    }),
    buildTask({
      id: 'demo-bio-notes',
      projectId: 'demo-proj-bio',
      parentTaskId: 'demo-bio-organise',
      title: 'Organise notes by topic',
      estimatedMinutes: 20,
      difficulty: 'medium',
      priority: 'medium',
      order: 33,
      createdAt: at(12, 11, 15),
    }),
    buildTask({
      id: 'demo-bio-write',
      projectId: 'demo-proj-bio',
      title: 'Write the assignment',
      estimatedMinutes: 210,
      difficulty: 'hard',
      priority: 'high',
      deadline: dueIn(6),
      createdAt: at(12, 12),
      order: 40,
    }),
    buildTask({
      id: 'demo-bio-outline',
      projectId: 'demo-proj-bio',
      parentTaskId: 'demo-bio-write',
      title: 'Create a section outline',
      estimatedMinutes: 15,
      difficulty: 'easy',
      priority: 'medium',
      dependencies: ['demo-bio-notes', 'demo-bio-extract'],
      order: 41,
      createdAt: at(12, 12, 5),
    }),
    buildTask({
      id: 'demo-bio-intro',
      projectId: 'demo-proj-bio',
      parentTaskId: 'demo-bio-write',
      title: 'Draft the introduction',
      estimatedMinutes: 30,
      difficulty: 'medium',
      priority: 'medium',
      order: 42,
      createdAt: at(12, 12, 10),
    }),
    buildTask({
      id: 'demo-bio-body',
      projectId: 'demo-proj-bio',
      parentTaskId: 'demo-bio-write',
      title: 'Write the main sections',
      estimatedMinutes: 90,
      difficulty: 'hard',
      priority: 'high',
      deadline: dueIn(5),
      dependencies: ['demo-bio-outline'],
      order: 43,
      createdAt: at(12, 12, 15),
    }),
    buildTask({
      id: 'demo-bio-evidence',
      projectId: 'demo-proj-bio',
      parentTaskId: 'demo-bio-write',
      title: 'Add supporting evidence',
      estimatedMinutes: 30,
      difficulty: 'medium',
      priority: 'medium',
      dependencies: ['demo-bio-body'],
      order: 44,
      createdAt: at(12, 12, 20),
    }),
    buildTask({
      id: 'demo-bio-conclusion',
      projectId: 'demo-proj-bio',
      parentTaskId: 'demo-bio-write',
      title: 'Write the conclusion',
      estimatedMinutes: 20,
      difficulty: 'medium',
      priority: 'medium',
      dependencies: ['demo-bio-body', 'demo-bio-evidence'],
      order: 45,
      createdAt: at(12, 12, 25),
    }),
    buildTask({
      id: 'demo-bio-review',
      projectId: 'demo-proj-bio',
      title: 'Review and submit',
      estimatedMinutes: 65,
      difficulty: 'medium',
      priority: 'high',
      deadline: dueIn(8),
      createdAt: at(12, 13),
      order: 50,
    }),
    buildTask({
      id: 'demo-bio-accuracy',
      projectId: 'demo-proj-bio',
      parentTaskId: 'demo-bio-review',
      title: 'Check scientific accuracy',
      estimatedMinutes: 20,
      difficulty: 'medium',
      priority: 'high',
      deadline: dueIn(7),
      dependencies: ['demo-bio-body'],
      order: 51,
      createdAt: at(12, 13, 5),
    }),
    buildTask({
      id: 'demo-bio-proofread',
      projectId: 'demo-proj-bio',
      parentTaskId: 'demo-bio-review',
      title: 'Proofread the full draft',
      estimatedMinutes: 15,
      difficulty: 'easy',
      priority: 'medium',
      dependencies: ['demo-bio-body'],
      order: 52,
      createdAt: at(12, 13, 10),
    }),
    buildTask({
      id: 'demo-bio-format',
      projectId: 'demo-proj-bio',
      parentTaskId: 'demo-bio-review',
      title: 'Check citations and formatting',
      estimatedMinutes: 15,
      difficulty: 'easy',
      priority: 'medium',
      dependencies: ['demo-bio-body'],
      order: 53,
      createdAt: at(12, 13, 15),
    }),
    buildTask({
      id: 'demo-bio-submit',
      projectId: 'demo-proj-bio',
      parentTaskId: 'demo-bio-review',
      title: 'Submit the assignment',
      estimatedMinutes: 5,
      difficulty: 'easy',
      priority: 'urgent',
      deadline: dueIn(8),
      dependencies: ['demo-bio-accuracy', 'demo-bio-proofread', 'demo-bio-format'],
      order: 54,
      createdAt: at(12, 13, 20),
    }),

    buildTask({
      id: 'demo-chem-alkenes',
      projectId: 'demo-proj-chem',
      title: 'Review alkene reactions',
      estimatedMinutes: 30,
      difficulty: 'medium',
      priority: 'medium',
      order: 10,
      createdAt: at(9, 15),
    }),
    buildTask({
      id: 'demo-chem-electro',
      projectId: 'demo-proj-chem',
      title: 'Practise electrophilic addition',
      estimatedMinutes: 40,
      difficulty: 'medium',
      priority: 'high',
      deadline: dueIn(2),
      scheduledDate: today,
      order: 20,
      createdAt: at(9, 15, 10),
    }),
    buildTask({
      id: 'demo-chem-nucleo',
      projectId: 'demo-proj-chem',
      title: 'Summarise nucleophilic substitution',
      estimatedMinutes: 30,
      difficulty: 'medium',
      priority: 'medium',
      deadline: dueIn(6),
      order: 30,
      createdAt: at(9, 15, 20),
    }),
    buildTask({
      id: 'demo-chem-pastpaper',
      projectId: 'demo-proj-chem',
      title: 'Attempt past-paper questions',
      estimatedMinutes: 60,
      difficulty: 'hard',
      priority: 'high',
      deadline: dueIn(4),
      dependencies: ['demo-chem-electro', 'demo-chem-nucleo'],
      order: 40,
      createdAt: at(9, 15, 30),
    }),
    buildTask({
      id: 'demo-chem-mistakes',
      projectId: 'demo-proj-chem',
      title: 'Review mistakes',
      estimatedMinutes: 20,
      difficulty: 'easy',
      priority: 'low',
      dependencies: ['demo-chem-pastpaper'],
      order: 50,
      createdAt: at(9, 15, 40),
    }),

    buildTask({
      id: 'demo-math-combinatorics',
      projectId: 'demo-proj-math',
      title: 'Review combinatorics problems',
      estimatedMinutes: 30,
      difficulty: 'medium',
      priority: 'medium',
      order: 10,
      createdAt: at(7, 17),
    }),
    buildTask({
      id: 'demo-math-problem',
      projectId: 'demo-proj-math',
      title: "Solve one problem from last year's paper",
      estimatedMinutes: 45,
      difficulty: 'hard',
      priority: 'high',
      deadline: dueIn(1),
      scheduledDate: today,
      order: 20,
      createdAt: at(7, 17, 10),
    }),
    buildTask({
      id: 'demo-math-review',
      projectId: 'demo-proj-math',
      title: 'Write a short solution review',
      estimatedMinutes: 20,
      difficulty: 'easy',
      priority: 'medium',
      dependencies: ['demo-math-problem'],
      order: 30,
      createdAt: at(7, 17, 20),
    }),

    buildTask({
      id: 'demo-english-question',
      projectId: 'demo-proj-english',
      title: 'Choose the essay question and thesis',
      description: 'Decide what the essay is actually arguing before collecting more evidence.',
      estimatedMinutes: 25,
      difficulty: 'medium',
      priority: 'high',
      deadline: dueIn(1),
      scheduledDate: today,
      order: 10,
      createdAt: at(9, 11, 5),
    }),
    buildTask({
      id: 'demo-english-quotes',
      projectId: 'demo-proj-english',
      title: 'Collect three quotations',
      estimatedMinutes: 30,
      difficulty: 'medium',
      priority: 'medium',
      deadline: dueIn(2),
      order: 20,
      createdAt: at(9, 11, 10),
    }),
    buildTask({
      id: 'demo-english-plan',
      projectId: 'demo-proj-english',
      title: 'Plan the argument',
      estimatedMinutes: 25,
      difficulty: 'medium',
      priority: 'high',
      dependencies: ['demo-english-question', 'demo-english-quotes'],
      order: 30,
      createdAt: at(9, 11, 15),
    }),
    buildTask({
      id: 'demo-english-intro',
      projectId: 'demo-proj-english',
      title: 'Write the introduction',
      estimatedMinutes: 30,
      difficulty: 'medium',
      priority: 'medium',
      dependencies: ['demo-english-plan'],
      order: 40,
      createdAt: at(9, 11, 20),
    }),
    buildTask({
      id: 'demo-english-draft',
      projectId: 'demo-proj-english',
      title: 'Draft the full essay',
      estimatedMinutes: 90,
      difficulty: 'hard',
      priority: 'high',
      deadline: dueIn(5),
      dependencies: ['demo-english-intro'],
      order: 50,
      createdAt: at(9, 11, 25),
    }),
    buildTask({
      id: 'demo-english-submit',
      projectId: 'demo-proj-english',
      title: 'Proofread and submit',
      estimatedMinutes: 30,
      difficulty: 'medium',
      priority: 'urgent',
      deadline: dueIn(6),
      dependencies: ['demo-english-draft'],
      order: 60,
      createdAt: at(9, 11, 30),
    }),

    buildTask({
      id: 'demo-space-desk',
      projectId: 'demo-proj-space',
      title: 'Clear the desk',
      estimatedMinutes: 10,
      difficulty: 'easy',
      priority: 'low',
      order: 10,
      createdAt: at(13, 10, 5),
    }),
    buildTask({
      id: 'demo-space-folders',
      projectId: 'demo-proj-space',
      title: 'Sort notes into folders',
      estimatedMinutes: 15,
      difficulty: 'easy',
      priority: 'low',
      dependencies: ['demo-space-desk'],
      order: 20,
      createdAt: at(13, 10, 10),
    }),
    buildTask({
      id: 'demo-space-lamp',
      projectId: 'demo-proj-space',
      title: 'Set up a reading lamp',
      estimatedMinutes: 10,
      difficulty: 'easy',
      priority: 'low',
      dependencies: ['demo-space-folders'],
      order: 30,
      createdAt: at(13, 10, 15),
    }),
  ];

  const completed: Record<string, { daysAgo: number; actual: number; hour?: number }> = {
    'demo-bio-brief': { daysAgo: 4, actual: 12, hour: 16 },
    'demo-bio-sections': { daysAgo: 4, actual: 8, hour: 16 },
    'demo-bio-marking': { daysAgo: 4, actual: 14, hour: 16 },
    'demo-bio-innate': { daysAgo: 1, actual: 36, hour: 17 },
    'demo-bio-antibody': { daysAgo: 0, actual: 18, hour: 11 },
    'demo-bio-sources': { daysAgo: 0, actual: 25, hour: 12 },
    'demo-bio-extract': { daysAgo: 0, actual: 34, hour: 13 },
    'demo-bio-notes': { daysAgo: 1, actual: 22, hour: 18 },
    'demo-bio-outline': { daysAgo: 2, actual: 18, hour: 15 },
    'demo-bio-intro': { daysAgo: 1, actual: 28, hour: 19 },
    'demo-chem-alkenes': { daysAgo: 2, actual: 35, hour: 16 },
    'demo-math-combinatorics': { daysAgo: 3, actual: 26, hour: 17 },
    'demo-space-desk': { daysAgo: 5, actual: 9, hour: 11 },
    'demo-space-folders': { daysAgo: 4, actual: 17, hour: 12 },
    'demo-space-lamp': { daysAgo: 3, actual: 12, hour: 18 },
  };

  const markCompleted = tasks.map((task) => {
    const record = completed[task.id];
    if (!record) return task;
    return {
      ...task,
      status: 'completed' as const,
      completedAt: at(record.daysAgo, record.hour ?? 17, 30),
      actualMinutes: record.actual,
    };
  });

  const linked = syncChildLinks(markCompleted);

  const derivedParents = linked.map((task) => {
    if (task.childTaskIds.length === 0) return task;
    const children = linked.filter((child) => child.parentTaskId === task.id);
    const allDone = children.length > 0 && children.every((child) => child.status === 'completed');
    if (!allDone) return { ...task, status: 'todo' as const, completedAt: null };
    const completions = children
      .map((child) => child.completedAt)
      .filter((value): value is string => Boolean(value))
      .sort();
    return {
      ...task,
      status: 'completed' as const,
      completedAt: completions[completions.length - 1] ?? null,
    };
  });

  const withDemoFlag = derivedParents.map((task) => ({ ...task, isDemo: true }));

  const activityMap = new Map<string, ActivityDay>();
  for (const task of withDemoFlag) {
    if (task.status !== 'completed' || !task.completedAt) continue;
    if (task.childTaskIds.length > 0) continue;
    const key = toDateKey(task.completedAt);
    const day = activityMap.get(key) ?? { date: key, tasks: 0, focusMinutes: 0 };
    day.tasks += 1;
    activityMap.set(key, day);
  }

  const focusSessions: FocusSession[] = [];
  for (let daysAgo = 0; daysAgo <= 15; daysAgo += 1) {
    if (daysAgo === 7) continue;
    const dayKey = toDateKey(at(daysAgo, 10));
    const sessionsForDay = daysAgo === 0 ? 2 : 1;
    for (let index = 0; index < sessionsForDay; index += 1) {
      const startedAt = new Date();
      startedAt.setDate(startedAt.getDate() - daysAgo);
      startedAt.setHours(9 + index, index === 0 ? 5 : 30, 0, 0);
      const endedAt = new Date(startedAt.getTime() + 25 * 60_000);
      const id = `demo-session-${daysAgo}-${index}`;
      focusSessions.push({
        id,
        taskId:
          daysAgo === 0
            ? 'demo-bio-antibody'
            : daysAgo % 2 === 0
              ? 'demo-bio-innate'
              : 'demo-bio-intro',
        type: 'focus',
        plannedSeconds: 1500,
        actualSeconds: 1500,
        startTime: startedAt.toISOString(),
        endTime: endedAt.toISOString(),
        status: 'completed',
        xpAwarded: true,
        isDemo: true,
      });
      const day = activityMap.get(dayKey) ?? { date: dayKey, tasks: 0, focusMinutes: 0 };
      day.focusMinutes += 25;
      activityMap.set(dayKey, day);
    }
  }

  focusSessions.push({
    id: 'demo-session-abandoned',
    taskId: 'demo-bio-adaptive',
    type: 'focus',
    plannedSeconds: 1500,
    actualSeconds: 540,
    startTime: at(2, 20, 10),
    endTime: at(2, 20, 19),
    status: 'abandoned',
    xpAwarded: false,
    isDemo: true,
  });

  const activityDates = [...activityMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  const streak = {
    activityDates,
    totalActiveDays: activityDates.length,
    lastActiveDate: activityDates[activityDates.length - 1]?.date ?? null,
    longestStreak: computeLongestStreak(activityDates),
    currentStreak: computeCurrentStreak(activityDates),
  };

  const achievementIds = [
    'first-step',
    'getting-started',
    'project-pioneer',
    'consistency',
    'adaptive-mindset',
    'seven-days',
    'deep-focus',
  ];
  const achievements: AchievementUnlock[] = achievementIds
    .map((id) => ACHIEVEMENTS.find((achievement) => achievement.id === id))
    .filter((achievement): achievement is (typeof ACHIEVEMENTS)[number] => Boolean(achievement))
    .map((achievement) => ({
      id: achievement.id,
      unlockedAt: at(4, 18),
      isDemo: true,
    }));

  const adaptations = [
    {
      id: 'demo-adaptation-1',
      taskId: 'demo-bio-intro',
      feedbackType: 'start' as const,
      userExplanation: 'The blank page felt impossible.',
      generatedTasks: [
        'Open the assignment document',
        'Write one sentence explaining the topic',
        'Add a sentence explaining the purpose',
        'Connect the sentences into an introduction',
      ],
      reasoning:
        'The task was reframed as a sequence of tiny, visible actions so the first move required no decisions.',
      createdAt: at(1, 19, 10),
      isDemo: true,
    },
  ];

  const objectives = refreshObjectives(
    generateObjectives(projects, withDemoFlag, DEFAULT_XP.objective, today),
    withDemoFlag,
    focusSessions,
    today,
  );

  const xpTransactions: XpTransaction[] = [];
  for (const task of withDemoFlag) {
    if (task.status !== 'completed' || task.childTaskIds.length > 0) continue;
    xpTransactions.push({
      id: `demo-xp-task-${task.id}`,
      source: `task:${task.id}`,
      amount: task.xpReward,
      timestamp: task.completedAt ?? at(3, 12),
      label: task.title,
      isDemo: true,
    });
  }
  for (const session of focusSessions) {
    if (session.status !== 'completed') continue;
    xpTransactions.push({
      id: `demo-xp-focus-${session.id}`,
      source: `focus:${session.id}`,
      amount: DEFAULT_XP.focus,
      timestamp: session.endTime,
      label: 'Focus session',
      isDemo: true,
    });
  }
  xpTransactions.push({
    id: 'demo-xp-project-space',
    source: 'project:demo-proj-space',
    amount: DEFAULT_XP.project,
    timestamp: at(3, 19),
    label: 'Study Space Reset',
    isDemo: true,
  });
  for (const achievement of achievements) {
    const definition = ACHIEVEMENTS.find((item) => item.id === achievement.id);
    if (!definition) continue;
    xpTransactions.push({
      id: `demo-xp-achievement-${achievement.id}`,
      source: `achievement:${achievement.id}`,
      amount: definition.xpReward,
      timestamp: achievement.unlockedAt,
      label: definition.name,
      isDemo: true,
    });
  }
  for (const objective of objectives) {
    if (!objective.completed) continue;
    xpTransactions.push({
      id: `demo-xp-objective-${objective.id}`,
      source: `objective:${objective.id}`,
      amount: objective.xpReward,
      timestamp: at(0, 14),
      label: 'Daily objective',
      isDemo: true,
    });
  }

  const xp = xpTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);

  const companionMessages: CompanionMessage[] = [
    {
      id: 'demo-companion-1',
      role: 'assistant',
      content:
        'Your Biology assignment is at its halfway point. The research section is the real bottleneck now, so I would start there rather than with the writing. Seven tasks are scheduled today, three are already complete, and two focus sessions are behind you.',
      createdAt: at(0, 8, 30),
      suggestions: [
        { label: 'What should I do first?', taskId: 'demo-bio-adaptive' },
        { label: 'Help me start the adaptive immunity research', taskId: 'demo-bio-adaptive' },
      ],
      isDemo: true,
    },
  ];

  const state: TakTicState = {
    ...base,
    profile: {
      ...base.profile,
      displayName: 'Mika',
      xp,
      level: levelInfo(xp).level,
    },
    projects,
    tasks: withDemoFlag,
    focusSessions,
    achievements,
    xpTransactions,
    objectives,
    objectivesDate: today,
    adaptations,
    streak,
    companionMessages,
    demoLoaded: true,
  };
  return state;
}
