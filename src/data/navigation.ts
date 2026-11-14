import {
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
  index: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Main',
    items: [
      { path: '/', label: 'Dashboard', index: '01', icon: LayoutGrid },
      { path: '/tasks', label: 'Tasks', index: '02', icon: ListChecks },
      { path: '/projects', label: 'Projects', index: '03', icon: FolderOpen },
      { path: '/focus', label: 'Focus', index: '04', icon: Timer },
      { path: '/calendar', label: 'Calendar', index: '05', icon: CalendarDays },
    ],
  },
  {
    label: 'Progress',
    items: [{ path: '/progress', label: 'Progress', index: '06', icon: BarChart3 }],
  },
  {
    label: 'Assistant',
    items: [{ path: '/companion', label: 'AI Companion', index: '07', icon: MessageCircle }],
  },
  {
    label: 'Utilities',
    items: [{ path: '/settings', label: 'Settings', index: '08', icon: Settings }],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

const ALIASES: Record<string, string> = {
  '/statistics': '/progress',
  '/achievements': '/progress',
  '/companion': '/companion',
};

export function pageMeta(pathname: string): { index: string; label: string } {
  const exact = NAV_ITEMS.find((item) => item.path === pathname);
  if (exact) return exact;
  const alias = ALIASES[pathname];
  if (alias) {
    const match = NAV_ITEMS.find((item) => item.path === alias);
    if (match) return match;
  }
  const match = NAV_ITEMS.find(
    (item) => item.path !== '/' && pathname.startsWith(item.path),
  );
  return match ?? NAV_ITEMS[0];
}
