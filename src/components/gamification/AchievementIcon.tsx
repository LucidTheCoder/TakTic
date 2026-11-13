import {
  CalendarCheck,
  Compass,
  Flame,
  FolderCheck,
  Footprints,
  ListChecks,
  Puzzle,
  Repeat,
  Target,
  Timer,
  Trophy,
  type LucideIcon,
} from 'lucide-react';

const icons: Record<string, LucideIcon> = {
  footprints: Footprints,
  timer: Timer,
  'folder-check': FolderCheck,
  'list-checks': ListChecks,
  flame: Flame,
  puzzle: Puzzle,
  repeat: Repeat,
  'calendar-check': CalendarCheck,
  target: Target,
  compass: Compass,
  library: Trophy,
};

export function AchievementIcon({
  name,
  size = 18,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const Icon = icons[name] ?? Trophy;
  return <Icon size={size} className={className} strokeWidth={1.6} aria-hidden />;
}
