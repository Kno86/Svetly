import { describe, expect, it } from 'vitest';
import {
  dayKey,
  eventsByDay,
  isMonth,
  monthGrid,
  monthLabel,
  shiftMonth,
  sinceMonth,
} from './calendar';

const event = (id: string, startsAt: string, endsAt: string | null = null) => ({
  id,
  slug: id,
  title: id,
  location: '',
  startsAt,
  endsAt,
  status: 'published' as const,
  isDemo: false,
});

describe('calendar', () => {
  it('uses the territory day, not UTC', () => {
    expect(dayKey('2026-10-31T18:30:00Z')).toBe('2026-11-01');
  });

  it('builds Monday-first weeks', () => {
    const weeks = monthGrid('2026-10');
    expect(weeks[0]![0]).toEqual({ key: '2026-09-28', day: 28, inMonth: false });
    expect(weeks.flat().filter((d) => d.inMonth)).toHaveLength(31);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.at(-1)!.at(-1)!.key).toBe('2026-11-01');
  });

  it('shifts across years and validates months', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(isMonth('2026-13')).toBe(false);
    expect(isMonth('2026-02')).toBe(true);
    expect(monthLabel('2026-10')).toBe('Октябрь 2026');
    expect(sinceMonth('2026-11')).toBe('с ноября 2026');
  });

  it('spreads multi-day events but clips them to the month', () => {
    const days = eventsByDay(
      [
        event('fair', '2026-09-30T03:00:00Z', '2026-10-02T10:00:00Z'),
        event('talk', '2026-10-02T12:00:00Z'),
      ],
      '2026-10',
    );
    expect([...days.keys()]).toEqual(['2026-10-01', '2026-10-02']);
    expect(days.get('2026-10-02')!.map((e) => e.id)).toEqual(['fair', 'talk']);
  });
});
