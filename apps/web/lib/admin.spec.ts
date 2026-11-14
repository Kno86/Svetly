import { describe, expect, it } from 'vitest';
import {
  ADMIN_NAV,
  CONTENT_KINDS,
  groupNav,
  navFor,
  toContentPayload,
  toFormValues,
  toInput,
} from './admin';

describe('admin navigation', () => {
  it('shows nothing to residents without permissions', () => {
    expect(navFor([])).toEqual([]);
  });

  it('shows only sections the role may manage', () => {
    const hrefs = navFor(['users.read', 'moderation.announcements', 'complaints.manage']).map(
      (i) => i.href,
    );
    expect(hrefs).toEqual([
      '/admin',
      '/admin/moderation',
      '/admin/moderation/announcements',
      '/admin/complaints',
      '/admin/records/announcements',
      '/admin/users',
    ]);
  });

  it('every gated section maps to a known permission', () => {
    const gated = ADMIN_NAV.filter((i) => i.permission).length;
    expect(navFor(ADMIN_NAV.flatMap((i) => (i.permission ? [i.permission] : []))).length).toBe(
      gated + 1,
    );
  });
});

describe('content forms', () => {
  const events = CONTENT_KINDS.events!;

  it('turns blanks into null and dates into ISO strings', () => {
    const values = toFormValues(events);
    values.title = '  Субботник ';
    values.startsAt = '2030-05-01T10:00';
    const body = toContentPayload(events, values);
    expect(body.title).toBe('Субботник');
    expect(body.startsAt).toBe(new Date('2030-05-01T10:00').toISOString());
    expect(body.endsAt).toBeNull();
    expect(body.capacity).toBeNull();
    expect(body.status).toBe('draft');
  });

  it('round-trips an existing record', () => {
    const iso = new Date(2030, 4, 1, 9, 5).toISOString();
    const values = toFormValues(events, {
      title: 'А',
      startsAt: iso,
      capacity: 20,
      status: 'published',
    });
    expect(values.startsAt).toBe('2030-05-01T09:05');
    expect(values.capacity).toBe('20');
    expect(toContentPayload(events, values)).toMatchObject({ capacity: 20, status: 'published' });
  });

  it('keeps required text empty strings and checkbox booleans', () => {
    const news = CONTENT_KINDS.news!;
    const body = toContentPayload(news, toFormValues(news));
    expect(body.excerpt).toBe('');
    expect(body.pinned).toBe(false);
    expect(body.sourceUrl).toBeNull();
  });

  it('defaults selects to their first option', () => {
    expect(toFormValues(CONTENT_KINDS.organizations!).kind).toBe('organization');
    expect(toInput('not a date', 'date')).toBe('');
  });
});

describe('groupNav', () => {
  it('groups visible items in a stable order', () => {
    const groups = groupNav(
      navFor(['users.read', 'moderation.announcements', 'complaints.manage']),
    );
    expect(groups.map((g) => g.group)).toEqual([null, 'Модерация', 'Все записи', 'Платформа']);
    expect(groups[1]?.items.map((i) => i.href)).toEqual([
      '/admin/moderation',
      '/admin/moderation/announcements',
      '/admin/complaints',
    ]);
  });
  it('puts every item except the overview into a group', () => {
    expect(ADMIN_NAV.filter((i) => !i.group).map((i) => i.href)).toEqual(['/admin']);
  });
});
