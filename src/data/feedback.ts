import {
  BookOpen,
  Clock3,
  Compass,
  HelpCircle,
  Minimize2,
  Package,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import type { FeedbackType } from '../types';

export interface FeedbackOption {
  id: FeedbackType;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const FEEDBACK_OPTIONS: FeedbackOption[] = [
  {
    id: 'understand',
    label: "I don't understand the topic",
    description: 'Build understanding before asking for output.',
    icon: BookOpen,
  },
  {
    id: 'start',
    label: "I don't know where to start",
    description: 'Make the first move almost weightless.',
    icon: Compass,
  },
  {
    id: 'too_big',
    label: 'This task feels too big',
    description: 'Split it into a visible sequence.',
    icon: Minimize2,
  },
  {
    id: 'concentration',
    label: "I'm struggling to concentrate",
    description: 'Shorten the window and lower friction.',
    icon: Waves,
  },
  {
    id: 'time',
    label: 'The estimated time is unrealistic',
    description: 'Recalculate using evidence, not optimism.',
    icon: Clock3,
  },
  {
    id: 'resources',
    label: "I don't have the resources I need",
    description: 'Turn a missing item into a small errand.',
    icon: Package,
  },
  {
    id: 'other',
    label: 'Something else',
    description: 'Say what is actually in the way.',
    icon: HelpCircle,
  },
];
