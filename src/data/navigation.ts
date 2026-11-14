import {
  Award,
  BarChart3,
  CalendarDays,
  FolderOpen,
  LayoutGrid,
  ListChecks,
  MessageCircle,
  Settings,
  Timer,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  jp?: string;
  index: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Dashboard', jp: '', index: '01', icon: LayoutGrid },
  { path: '/tasks', label: 'My Tasks', jp: '', index: '02', icon: ListChecks },
  { path: '/projects', label: 'Projects', jp: '', index: '03', icon: FolderOpen },
  { path: '/focus', label: 'Focus Room', jp: '', index: '04', icon: Timer },
  { path: '/companion', label: 'Ask AI', jp: '', index: '05', icon: MessageCircle },
  { path: '/calendar', label: 'Calendar', jp: '', index: '06', icon: CalendarDays },
  { path: '/statistics', label: 'Statistics', jp: '', index: '07', icon: BarChart3 },
  { path: '/achievements', label: 'Achievements', jp: '', index: '08', icon: Award },
  { path: '/settings', label: 'Settings', jp: '', index: '09', icon: Settings },
];

export function pageMeta(pathname: string): { index: string; label: string; jp?: string } {
  const exact = NAV_ITEMS.find((item) => item.path === pathname);
  if (exact) return exact;
  const match = NAV_ITEMS.find(
    (item) => item.path !== '/' && pathname.startsWith(item.path),
  );
  return match ?? NAV_ITEMS[0];
}
