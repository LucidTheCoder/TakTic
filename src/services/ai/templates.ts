import type { FeedbackType, Task, TaskDraft } from '../../types';

/**
 * These helpers are structural templates, not AI output. The interface labels
 * them explicitly so nothing is ever passed off as a generated response.
 */

export function templateDecomposition(goal: string): {
  projectTitle: string;
  projectDescription: string;
  phases: Array<{ title: string; tasks: TaskDraft[] }>;
} {
  return {
    projectTitle: goal.trim().slice(0, 120) || 'New project',
    projectDescription:
      'A starter structure created from a fixed template. Edit the steps so they match your actual assignment.',
    phases: [
      {
        title: 'Understand the brief',
        tasks: [
          {
            title: 'Read the assignment brief',
            description: 'Read once for meaning, once for requirements.',
            estimatedMinutes: 15,
            difficulty: 'easy',
          },
          {
            title: 'Write down the required sections',
            description: '',
            estimatedMinutes: 10,
            difficulty: 'easy',
          },
          {
            title: 'List the marking criteria',
            description: '',
            estimatedMinutes: 10,
            difficulty: 'easy',
          },
        ],
      },
      {
        title: 'Gather material',
        tasks: [
          {
            title: 'Collect three reliable sources',
            description: 'Use the reading list or library catalogue rather than general search results.',
            estimatedMinutes: 25,
            difficulty: 'medium',
          },
          {
            title: 'Take notes from the first source',
            description: '',
            estimatedMinutes: 30,
            difficulty: 'medium',
          },
          {
            title: 'Organise notes by section',
            description: '',
            estimatedMinutes: 20,
            difficulty: 'easy',
          },
        ],
      },
      {
        title: 'Draft',
        tasks: [
          {
            title: 'Create an outline',
            description: '',
            estimatedMinutes: 20,
            difficulty: 'easy',
          },
          {
            title: 'Draft the first section',
            description: 'A rough version is enough.',
            estimatedMinutes: 35,
            difficulty: 'medium',
          },
          {
            title: 'Draft the remaining sections',
            description: '',
            estimatedMinutes: 60,
            difficulty: 'hard',
          },
        ],
      },
      {
        title: 'Review and submit',
        tasks: [
          {
            title: 'Proofread the full draft',
            description: '',
            estimatedMinutes: 20,
            difficulty: 'medium',
          },
          {
            title: 'Check citations and formatting',
            description: '',
            estimatedMinutes: 15,
            difficulty: 'easy',
          },
          {
            title: 'Submit',
            description: 'Confirm the upload or hand-in.',
            estimatedMinutes: 5,
            difficulty: 'easy',
          },
        ],
      },
    ],
  };
}

interface TemplateAdaptation {
  reasoning: string;
  subtasks: TaskDraft[];
  revisedEstimateMinutes?: number;
  suggestedFocusMinutes?: number;
}

export function templateAdaptation(task: Task, feedback: FeedbackType): TemplateAdaptation {
  const minutes = (value: number) => Math.max(5, Math.min(45, Math.round(value)));

  const builds: Record<FeedbackType, () => TemplateAdaptation> = {
    understand: () => ({
      reasoning:
        'A fixed template that builds understanding before asking for output. Start with a definition and one example, then write it back in your own words.',
      subtasks: [
        {
          title: `Write down what "${task.title}" is asking`,
          description: 'One sentence, no polish needed.',
          estimatedMinutes: 5,
          difficulty: 'easy',
        },
        {
          title: 'Find one plain explanation of the core idea',
          description: 'Use your notes, textbook or reading list.',
          estimatedMinutes: 15,
          difficulty: 'easy',
        },
        {
          title: 'Explain the idea in your own words',
          description: 'Three or four sentences is enough.',
          estimatedMinutes: 10,
          difficulty: 'medium',
        },
        {
          title: 'List what is still unclear',
          description: 'Turn each gap into a question to ask or look up.',
          estimatedMinutes: 10,
          difficulty: 'easy',
        },
      ],
      suggestedFocusMinutes: 20,
    }),
    start: () => ({
      reasoning:
        'A fixed template that lowers the first step until it requires no decision. The aim is contact with the work, not a finished draft.',
      subtasks: [
        {
          title: 'Open the document or source',
          description: 'No editing yet.',
          estimatedMinutes: 5,
          difficulty: 'easy',
        },
        {
          title: 'Write one rough sentence',
          description: 'It does not need to be good.',
          estimatedMinutes: 10,
          difficulty: 'easy',
        },
        {
          title: 'Add three bullet points',
          description: 'Rough notes are fine.',
          estimatedMinutes: 10,
          difficulty: 'easy',
        },
        {
          title: 'Tidy it into a first pass',
          description: 'Stop after fifteen minutes.',
          estimatedMinutes: 15,
          difficulty: 'medium',
        },
      ],
      suggestedFocusMinutes: 15,
    }),
    too_big: () => ({
      reasoning:
        'A fixed template that narrows scope to a visible first section, with a clear stopping point.',
      subtasks: [
        {
          title: 'Divide this into three parts',
          description: 'Write the parts as headings.',
          estimatedMinutes: 10,
          difficulty: 'easy',
        },
        {
          title: 'Do the smallest part only',
          estimatedMinutes: 20,
          difficulty: 'easy',
        },
        {
          title: 'Stop and check what is left',
          description: 'Do not start the next part yet.',
          estimatedMinutes: 5,
          difficulty: 'easy',
        },
        {
          title: 'Schedule the next part',
          description: 'Choose one date and time.',
          estimatedMinutes: 5,
          difficulty: 'easy',
        },
      ],
      suggestedFocusMinutes: 20,
    }),
    concentration: () => ({
      reasoning:
        'A fixed template that shortens the working window and removes avoidable decisions before starting.',
      subtasks: [
        {
          title: 'Clear one distraction',
          description: 'Close tabs, put the phone out of reach.',
          estimatedMinutes: 5,
          difficulty: 'easy',
        },
        {
          title: 'Work for ten minutes only',
          description: 'Set a timer. Stop when it rings.',
          estimatedMinutes: 10,
          difficulty: 'easy',
        },
        {
          title: 'Note where you stopped',
          description: 'One line is enough to restart later.',
          estimatedMinutes: 5,
          difficulty: 'easy',
        },
        {
          title: 'Decide whether to continue',
          description: 'Another ten minutes or a real break.',
          estimatedMinutes: 5,
          difficulty: 'easy',
        },
      ],
      suggestedFocusMinutes: 10,
    }),
    time: () => ({
      reasoning:
        'A fixed template that tests the estimate on a small slice rather than assuming the original figure was right.',
      subtasks: [
        {
          title: 'Set a ten-minute timer and begin',
          estimatedMinutes: 10,
          difficulty: 'easy',
        },
        {
          title: 'Note how far ten minutes took you',
          description: 'Rough proportion is enough.',
          estimatedMinutes: 5,
          difficulty: 'easy',
        },
        {
          title: 'Reduce this task to its essential minimum',
          description: 'Name what can be left out.',
          estimatedMinutes: 10,
          difficulty: 'medium',
        },
        {
          title: 'Record a new estimate from evidence',
          description: 'Use what the trial actually showed.',
          estimatedMinutes: 5,
          difficulty: 'easy',
        },
      ],
      revisedEstimateMinutes: Math.max(15, Math.round(task.estimatedMinutes * 0.6)),
      suggestedFocusMinutes: 15,
    }),
    resources: () => ({
      reasoning:
        'A fixed template that turns the missing resource into a concrete small errand, then offers a realistic fallback. It does not invent resources.',
      subtasks: [
        {
          title: 'List exactly what is missing',
          description: 'Name the file, book, tool or access.',
          estimatedMinutes: 10,
          difficulty: 'easy',
        },
        {
          title: 'Find the nearest legitimate source',
          description: 'Library, course page, tutor or classmate.',
          estimatedMinutes: 15,
          difficulty: 'medium',
        },
        {
          title: 'Work with what is already available',
          description: 'Do the part that does not need the missing item.',
          estimatedMinutes: 20,
          difficulty: 'medium',
        },
        {
          title: 'Ask for the missing item',
          description: 'One short message or question.',
          estimatedMinutes: 5,
          difficulty: 'easy',
        },
      ],
      suggestedFocusMinutes: 20,
    }),
    other: () => ({
      reasoning:
        'A fixed template that makes the next action concrete. Adjust the wording so it fits what is actually blocking you.',
      subtasks: [
        {
          title: 'Write one sentence about what is blocking you',
          estimatedMinutes: minutes(task.estimatedMinutes * 0.15),
          difficulty: 'easy',
        },
        {
          title: 'Identify the smallest possible next action',
          estimatedMinutes: 10,
          difficulty: 'easy',
        },
        {
          title: 'Do only that action',
          estimatedMinutes: minutes(task.estimatedMinutes * 0.4),
          difficulty: 'medium',
        },
        {
          title: 'Decide the next step after it is done',
          estimatedMinutes: 5,
          difficulty: 'easy',
        },
      ],
      suggestedFocusMinutes: 15,
    }),
  };

  return { ...builds[feedback](), subtasks: builds[feedback]().subtasks };
}
