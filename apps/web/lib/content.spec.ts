import { describe, expect, it, vi } from 'vitest';
import {
  apiGet,
  excerptOf,
  dateParts,
  eventPhase,
  formatPrice,
  pageParam,
  paragraphs,
  query,
} from './content';

describe('content helpers', () => {
  it('builds query strings without empty values', () => {
    expect(query({ q: 'дом', category: '', page: 2 })).toBe('?q=%D0%B4%D0%BE%D0%BC&page=2');
    expect(query({})).toBe('');
  });
  it('formats prices honestly', () => {
    expect(formatPrice(null)).toBe('Цена не указана');
    expect(formatPrice(0)).toBe('Бесплатно');
    expect(formatPrice(15000)).toMatch(/^15\s000 ₽$/);
  });
  it('sanitises page numbers', () => {
    expect(pageParam({ page: '3' })).toBe(3);
    expect(pageParam({ page: '-1' })).toBe(1);
    expect(pageParam({ page: 'abc' })).toBe(1);
  });
  it('splits paragraphs', () => {
    expect(paragraphs('a\n\n\nb\n')).toEqual(['a', 'b']);
  });
  it('reports API errors instead of inventing data', async () => {
    const failing = vi.fn().mockResolvedValue(new Response('x', { status: 503 }));
    expect(await apiGet('/api/news', failing)).toEqual({ ok: false, status: 503 });
    const throwing = vi.fn().mockRejectedValue(new Error('down'));
    expect(await apiGet('/api/news', throwing)).toEqual({ ok: false, status: 0 });
  });
});

describe('eventPhase', () => {
  const now = Date.parse('2026-10-19T12:00:00Z');
  it('treats an event without end date as ended once it starts', () => {
    expect(eventPhase('2026-10-19T11:00:00Z', null, now)).toEqual({ started: true, ended: true });
  });
  it('keeps a running event with an end date active', () => {
    expect(eventPhase('2026-10-19T11:00:00Z', '2026-10-19T13:00:00Z', now)).toEqual({
      started: true,
      ended: false,
    });
  });
  it('marks future events as not started', () => {
    expect(eventPhase('2026-10-20T11:00:00Z', null, now)).toEqual({ started: false, ended: false });
  });
});

describe('dateParts', () => {
  it('uses the Novosibirsk zone', () => {
    expect(dateParts('2026-10-19T11:00:00Z')).toEqual({ day: '19', month: 'окт', time: '18:00' });
    expect(dateParts('2026-12-31T20:30:00Z')).toEqual({ day: '1', month: 'янв', time: '03:30' });
  });
});

describe('excerptOf', () => {
  it('keeps short text and flattens whitespace', () => {
    expect(excerptOf('  Велосипед\n\nв хорошем   состоянии ')).toBe(
      'Велосипед в хорошем состоянии',
    );
  });
  it('cuts long text at a word boundary with an ellipsis', () => {
    const out = excerptOf('слово '.repeat(60), 40);
    expect(out.length).toBeLessThanOrEqual(41);
    expect(out.endsWith('слово…')).toBe(true);
  });
});
