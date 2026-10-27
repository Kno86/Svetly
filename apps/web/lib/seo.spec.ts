import { describe, expect, it } from 'vitest';
import { indexingEnabled, siteUrl, sitemapEntries, type SitemapData } from './seo';

describe('seo helpers', () => {
  it('keeps indexing off unless explicitly enabled', () => {
    expect(indexingEnabled({})).toBe(false);
    expect(indexingEnabled({ SVETLY_INDEXING: 'true' })).toBe(false);
    expect(indexingEnabled({ SVETLY_INDEXING: 'enabled' })).toBe(true);
  });

  it('normalises the public URL', () => {
    expect(siteUrl({ SVETLY_PUBLIC_URL: 'https://svetly.example/' })).toBe(
      'https://svetly.example',
    );
    expect(siteUrl({})).toBe('http://localhost:3000');
  });

  it('builds sitemap URLs from public slugs only', () => {
    const empty = {
      news: [],
      announcements: [],
      organizations: [],
      services: [],
      events: [],
      jobs: [],
      lostFound: [],
      polls: [],
      groups: [],
    };
    const data: SitemapData = {
      ...empty,
      jobs: [{ slug: 'povar', updatedAt: '2026-01-01T00:00:00Z' }],
      lostFound: [{ slug: 'klyuchi', updatedAt: '2026-01-02T00:00:00Z' }],
    };
    const urls = sitemapEntries('https://s.example', data).map((e) => e.url);
    expect(urls).toContain('https://s.example');
    expect(urls).toContain('https://s.example/jobs/povar');
    expect(urls).toContain('https://s.example/lost-found/klyuchi');
    expect(urls.some((u) => u.includes('/account') || u.includes('/messages'))).toBe(false);
    expect(sitemapEntries('https://s.example', null).length).toBeGreaterThan(5);
  });
});
