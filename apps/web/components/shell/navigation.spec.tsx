import { describe, expect, it } from 'vitest';
import {
  isActive,
  loginHref,
  moreNav,
  primaryNav,
  safeNext,
  tabsFor,
  visibleSections,
} from './navigation';

describe('site navigation', () => {
  it('marks the section of nested and merged modules', () => {
    const section = (label: string) => primaryNav.find((s) => s.label === label)!;
    expect(isActive(section('Объявления'), '/lost-found/abc')).toBe(true);
    expect(isActive(section('Услуги и бизнес'), '/directory')).toBe(true);
    expect(isActive(section('Сообщество'), '/groups/x')).toBe(true);
    expect(isActive(section('Новости'), '/newsletter')).toBe(false);
  });

  it('keeps every module reachable from the drawer', () => {
    expect(moreNav.map((i) => i.href)).toContain('/jobs');
    expect(moreNav.some((i) => primaryNav.some((s) => s.href === i.href))).toBe(false);
  });

  it('accepts only same-site return paths', () => {
    expect(safeNext('/groups/x?tab=1')).toBe('/groups/x?tab=1');
    expect(safeNext('//evil.example')).toBeNull();
    expect(safeNext('https://evil.example')).toBeNull();
    expect(safeNext('/\\evil.example')).toBeNull();
    expect(safeNext('/login?next=/x')).toBeNull();
    expect(safeNext(null)).toBeNull();
  });

  it('builds the login link with a return path', () => {
    expect(loginHref('/messages')).toBe('/login?next=%2Fmessages');
    expect(loginHref('/')).toBe('/login');
    expect(loginHref('/register')).toBe('/login');
  });

  it('shows section tabs only on section list pages', () => {
    expect(tabsFor('/jobs')?.section.label).toBe('Объявления');
    expect(tabsFor('/map')?.items.map((i) => i.href)).toContain('/directory');
    expect(tabsFor('/community')?.section.label).toBe('Сообщество');
    expect(tabsFor('/jobs/some-job')).toBeNull();
    expect(tabsFor('/news')).toBeNull();
  });

  it('ties scattered cabinet pages into one tab row', () => {
    expect(tabsFor('/messages')?.section.label).toBe('Кабинет');
    expect(tabsFor('/account/announcements')?.items.map((i) => i.href)).toContain('/favorites');
    expect(tabsFor('/messages/some-id')).toBeNull();
    expect(tabsFor('/business')).toBeNull();
  });

  it('keeps a merged section while any of its modules is on', () => {
    const hrefs = (f: Record<string, boolean>) => visibleSections(f).map((s) => s.href);
    expect(hrefs({})).toContain('/announcements');
    expect(hrefs({ news: false })).not.toContain('/news');
    expect(hrefs({ announcements: false })).toContain('/jobs');
    expect(
      visibleSections({ announcements: false, jobs: false, lost_found: false }).map((s) => s.label),
    ).not.toContain('Объявления');
  });
});
