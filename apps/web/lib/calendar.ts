const TZ = 'Asia/Novosibirsk';
const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const MONTH = /^(20\d\d)-(0[1-9]|1[0-2])$/;

export interface CalendarEvent {
  id: string;
  slug: string;
  title: string;
  location: string;
  startsAt: string;
  endsAt: string | null;
  status: 'published' | 'cancelled';
  isDemo: boolean;
}

export interface CalendarDay {
  key: string;
  day: number;
  inMonth: boolean;
}

/** `YYYY-MM-DD` of an instant in the territory's time zone. */
export function dayKey(value: string | Date): string {
  return dayFormat.format(new Date(value));
}

export function isMonth(value: string | undefined): value is string {
  return Boolean(value && MONTH.test(value));
}

export function currentMonth(now: Date = new Date()): string {
  return dayKey(now).slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const name = new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
  return `${name[0]!.toUpperCase()}${name.slice(1)} ${y}`;
}

/** «с ноября 2026»: the month in the genitive case, as after «с». */
export function sinceMonth(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const name = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, 1)))
    .replace(/^\d+\s*/, '');
  return `с ${name} ${y}`;
}

/** Monday-first weeks covering the month, padded with neighbouring days. */
export function monthGrid(month: string): CalendarDay[][] {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = new Date(first);
  start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7));
  const weeks: CalendarDay[][] = [];
  const cursor = new Date(start);
  do {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i += 1) {
      week.push({
        key: cursor.toISOString().slice(0, 10),
        day: cursor.getUTCDate(),
        inMonth: cursor.getUTCMonth() === m - 1,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  } while (cursor.getUTCMonth() === m - 1);
  return weeks;
}

/** Events per day of the month; a multi-day event appears on every day it spans. */
export function eventsByDay<T extends CalendarEvent>(items: T[], month: string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const first = dayKey(item.startsAt);
    const last = item.endsAt ? dayKey(item.endsAt) : first;
    const cursor = new Date(`${first}T00:00:00Z`);
    for (let key = first; key <= last;) {
      if (key.startsWith(month)) out.set(key, [...(out.get(key) ?? []), item]);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      key = cursor.toISOString().slice(0, 10);
    }
  }
  return out;
}
