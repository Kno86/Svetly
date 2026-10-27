import { describe, expect, it } from 'vitest';
import { type Candidate, rank, score } from './recommendations.js';

const now = new Date('2026-10-20T12:00:00Z');
const day = 86_400_000;
const c = (over: Partial<Candidate>): Candidate => ({
  type: 'news',
  id: 'a',
  slug: 'a',
  title: 'A',
  date: new Date(now.getTime() - day),
  category: null,
  ...over,
});

describe('recommendations', () => {
  it('explains every point', () => {
    const r = score(c({ category: { id: 'k', name: 'Спорт' } }), new Set(['k']), now);
    expect(r.score).toBe(5);
    expect(r.reasons).toEqual(['Категория «Спорт» есть в ваших интересах', 'Свежая публикация']);
  });
  it('scores upcoming events and drops stale, unscored and hidden items', () => {
    const items = [
      c({ id: 'old', date: new Date(now.getTime() - 60 * day) }),
      c({ id: 'ev', type: 'event', date: new Date(now.getTime() + 2 * day) }),
      c({ id: 'week', date: new Date(now.getTime() - 10 * day) }),
      c({ id: 'hid' }),
    ];
    const out = rank(items, new Set(), new Set(['news:hid']), now);
    expect(out.map((r) => r.id)).toEqual(['ev', 'week']);
    expect(out[0]!.reasons).toEqual(['Событие в ближайшие 7 дней']);
  });
});
