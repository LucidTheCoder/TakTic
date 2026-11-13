const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;

export function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

export function toDateKey(input: Date | number | string): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return todayKey();
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 0, 0, 0, 0);
}

export function isDateKey(value: string): boolean {
  return dateKeyPattern.test(value);
}

export function addDays(dateKey: string, amount: number): string {
  const date = fromDateKey(dateKey);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

/** Calendar-day difference that is immune to DST and timezone shifts. */
export function diffCalendarDays(fromKey: string, toKey: string): number {
  const from = fromDateKey(fromKey);
  const to = fromDateKey(toKey);
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

export function formatDateKey(
  key: string,
  options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' },
): string {
  return new Intl.DateTimeFormat('en-GB', options).format(fromDateKey(key));
}

export function formatLongDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatShortDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(date);
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(
    new Date(iso),
  );
}

export function formatDeadline(iso: string | null, hasTime = false): string {
  if (!iso) return 'No deadline';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'No deadline';
  const key = toDateKey(date);
  const day = formatDateKey(key, { day: 'numeric', month: 'short' });
  if (!hasTime) return day;
  return `${day} · ${formatTime(iso)}`;
}

export type DeadlineTone = 'none' | 'overdue' | 'soon' | 'neutral' | 'later';

export function deadlineInfo(iso: string | null, hasTime: boolean, done: boolean) {
  if (!iso) {
    return { label: '', tone: 'none' as DeadlineTone, days: null as number | null };
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { label: '', tone: 'none' as DeadlineTone, days: null };
  }
  const dueKey = toDateKey(date);
  const today = todayKey();
  const days = diffCalendarDays(today, dueKey);
  const baseLabel = formatDeadline(iso, hasTime);

  if (done) return { label: `${baseLabel}`, tone: 'neutral' as DeadlineTone, days };
  if (date.getTime() < Date.now() && (hasTime || days < 0)) {
    return { label: days < 0 ? `${Math.abs(days)}d overdue` : 'Overdue', tone: 'overdue' as DeadlineTone, days };
  }
  if (days === 0) return { label: 'Due today', tone: 'soon' as DeadlineTone, days };
  if (days === 1) return { label: 'Due tomorrow', tone: 'soon' as DeadlineTone, days };
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, tone: 'overdue' as DeadlineTone, days };
  if (days <= 3) return { label: `In ${days} days`, tone: 'soon' as DeadlineTone, days };
  return { label: baseLabel, tone: 'neutral' as DeadlineTone, days };
}

export function isOverdue(deadline: string | null, hasTime: boolean, completed: boolean): boolean {
  if (!deadline || completed) return false;
  const info = deadlineInfo(deadline, hasTime, completed);
  return info.tone === 'overdue';
}

export function startOfWeekKey(dateKey: string): string {
  const date = fromDateKey(dateKey);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(dateKey, diff);
}

export function weekKeys(dateKey: string): string[] {
  const start = startOfWeekKey(dateKey);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function monthMatrix(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  const firstDay = first.getDay();
  const offset = firstDay === 0 ? -6 : 1 - firstDay;
  const start = new Date(year, month, 1 + offset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return toDateKey(date);
  });
}

export function formatDuration(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${pad2(minutes)}:${pad2(seconds)}`;
}

export function minutesBetween(startIso: string, endIso: string): number {
  return Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000));
}

export function isoFromDateAndTime(dateKey: string, time?: string | null): string {
  if (time) {
    const [hours, minutes] = time.split(':').map(Number);
    const date = fromDateKey(dateKey);
    date.setHours(hours || 0, minutes || 0, 0, 0);
    return date.toISOString();
  }
  const date = fromDateKey(dateKey);
  date.setHours(23, 59, 0, 0);
  return date.toISOString();
}

export function splitDeadline(iso: string | null, hasTime: boolean): { dateKey: string; time: string } {
  if (!iso) return { dateKey: '', time: '' };
  const date = new Date(iso);
  return {
    dateKey: toDateKey(date),
    time: hasTime ? `${pad2(date.getHours())}:${pad2(date.getMinutes())}` : '',
  };
}

export function greetingForHour(hour = new Date().getHours()): string {
  if (hour < 5) return 'Still awake';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function startOfIsoDay(iso: string): number {
  const date = new Date(iso);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function isSameLocalDay(aIso: string | null, bIso: string | null): boolean {
  if (!aIso || !bIso) return false;
  return toDateKey(aIso) === toDateKey(bIso);
}

export function humanRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateKey(toDateKey(iso));
}
