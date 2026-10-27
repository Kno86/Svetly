/** Indexing stays off until launch: set SVETLY_INDEXING=enabled to allow search engines. */
export function indexingEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.SVETLY_INDEXING === 'enabled';
}

export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  return (env.SVETLY_PUBLIC_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

/** Private areas that must never be crawled even when indexing is enabled. */
export const PRIVATE_PATHS = [
  '/account',
  '/admin',
  '/business',
  '/messages',
  '/notifications',
  '/favorites',
  '/submit',
  '/api/',
];

export interface SitemapData {
  news: SitemapRow[];
  announcements: SitemapRow[];
  organizations: SitemapRow[];
  services: SitemapRow[];
  events: SitemapRow[];
  jobs: SitemapRow[];
  lostFound: SitemapRow[];
  polls: SitemapRow[];
  groups: SitemapRow[];
}
export interface SitemapRow {
  slug: string;
  updatedAt: string;
}

const SECTIONS: Array<[keyof SitemapData, string]> = [
  ['news', '/news'],
  ['announcements', '/announcements'],
  ['organizations', '/organizations'],
  ['services', '/services'],
  ['events', '/events'],
  ['jobs', '/jobs'],
  ['lostFound', '/lost-found'],
  ['polls', '/polls'],
  ['groups', '/groups'],
];
const STATIC = ['/', '/directory', '/feed', '/issues', ...SECTIONS.map(([, p]) => p)];

export function sitemapEntries(
  base: string,
  data: SitemapData | null,
): Array<{ url: string; lastModified?: string }> {
  const entries: Array<{ url: string; lastModified?: string }> = STATIC.map((p) => ({
    url: `${base}${p === '/' ? '' : p}`,
  }));
  if (!data) return entries;
  for (const [key, path] of SECTIONS)
    for (const row of data[key] ?? [])
      entries.push({
        url: `${base}${path}/${encodeURIComponent(row.slug)}`,
        lastModified: row.updatedAt,
      });
  return entries;
}
