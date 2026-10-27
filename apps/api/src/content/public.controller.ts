import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { z } from 'zod';
import { parse } from '../common/validation.js';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { sanitizeQuery } from '../analytics/events.js';
import { PrismaService } from '../prisma/prisma.service.js';

const MODULES = [
  'news',
  'announcements',
  'services',
  'organizations',
  'events',
  'directory',
] as const;
const page = {
  q: z.string().trim().max(200).optional(),
  category: z.string().max(80).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
};
const listQuery = z.object(page);
const orgQuery = z.object({ ...page, kind: z.enum(['organization', 'service']).optional() });
const eventQuery = z.object({ ...page, when: z.enum(['upcoming', 'past']).default('upcoming') });
export const SEARCH_TYPES = [
  'news',
  'announcements',
  'organizations',
  'services',
  'events',
  'directory',
  'jobs',
  'lost_found',
  'groups',
  'posts',
] as const;
/** Types whose rows carry a category; a category filter limits the search to these. */
const CATEGORIZED = new Set([
  'news',
  'announcements',
  'organizations',
  'services',
  'events',
  'directory',
]);
const searchQuery = z.object({
  q: z.string().trim().min(2).max(200),
  type: z.enum(SEARCH_TYPES).optional(),
  category: z
    .string()
    .regex(/^[a-z0-9-]{1,80}$/)
    .optional(),
  sort: z.enum(['relevance', 'date']).default('relevance'),
  page: z.coerce.number().int().min(1).max(50).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
const suggestQuery = z.object({ q: z.string().trim().min(2).max(100) });
const SITEMAP_LIMIT = 5000;

const category = { select: { slug: true, name: true } } as const;
const announcementPublic = {
  id: true,
  slug: true,
  title: true,
  description: true,
  price: true,
  condition: true,
  area: true,
  imageIds: true,
  publishedAt: true,
  expiresAt: true,
  isDemo: true,
  status: true,
  category,
} satisfies Prisma.AnnouncementSelect;

/** Only published, non-expired content is ever returned here — drafts/pending/rejected never leak via lists, slugs or search. */
export function publishedAnnouncement(now = new Date()): Prisma.AnnouncementWhereInput {
  return { status: 'published', expiresAt: { gt: now } };
}

function categoryFilter(slug?: string) {
  return slug ? { category: { slug } } : {};
}

function textFilter(q: string | undefined, fields: string[]) {
  if (!q) return {};
  return { OR: fields.map((f) => ({ [f]: { contains: q, mode: 'insensitive' as const } })) };
}

@Controller()
export class PublicContentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  @Get('categories')
  categories(@Query('module') module?: string) {
    const where =
      module && (MODULES as readonly string[]).includes(module)
        ? { module, active: true }
        : { active: true };
    return this.prisma.category.findMany({
      where,
      orderBy: [{ module: 'asc' }, { position: 'asc' }],
      select: { id: true, module: true, slug: true, name: true },
    });
  }

  @Get('news')
  async news(@Query() query: unknown) {
    const { q, category: cat, page: p, limit } = parse(listQuery, query);
    const where: Prisma.NewsArticleWhereInput = {
      status: 'published',
      ...categoryFilter(cat),
      ...textFilter(q, ['title', 'excerpt', 'body']),
    };
    const [items, total] = await Promise.all([
      this.prisma.newsArticle.findMany({
        where,
        orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
        skip: (p - 1) * limit,
        take: limit,
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          coverId: true,
          pinned: true,
          publishedAt: true,
          isDemo: true,
          category,
        },
      }),
      this.prisma.newsArticle.count({ where }),
    ]);
    return { items, total, page: p, limit };
  }

  @Get('news/:slug')
  async newsItem(@Param('slug') slug: string) {
    const item = await this.prisma.newsArticle.findFirst({
      where: { slug, status: 'published' },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        body: true,
        coverId: true,
        pinned: true,
        sourceName: true,
        sourceUrl: true,
        publishedAt: true,
        updatedAt: true,
        isDemo: true,
        category,
      },
    });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND' });
    return item;
  }

  @Get('announcements')
  async announcements(@Query() query: unknown) {
    const { q, category: cat, page: p, limit } = parse(listQuery, query);
    const where: Prisma.AnnouncementWhereInput = {
      ...publishedAnnouncement(),
      ...categoryFilter(cat),
      ...textFilter(q, ['title', 'description']),
    };
    const [items, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (p - 1) * limit,
        take: limit,
        select: announcementPublic,
      }),
      this.prisma.announcement.count({ where }),
    ]);
    return { items, total, page: p, limit };
  }

  /** Contact phone is returned only on the detail page; it is the author's explicit choice to publish it. */
  @Get('announcements/:slug')
  async announcement(@Param('slug') slug: string) {
    const item = await this.prisma.announcement.findFirst({
      where: { slug, ...publishedAnnouncement() },
      select: { ...announcementPublic, contactPhone: true },
    });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND' });
    return item;
  }

  @Get('organizations')
  async organizations(@Query() query: unknown) {
    const { q, category: cat, kind, page: p, limit } = parse(orgQuery, query);
    const where: Prisma.OrganizationWhereInput = {
      status: 'published',
      ...(kind ? { kind } : {}),
      ...categoryFilter(cat),
      ...textFilter(q, ['name', 'services', 'description']),
    };
    const [items, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (p - 1) * limit,
        take: limit,
        select: {
          id: true,
          slug: true,
          kind: true,
          name: true,
          description: true,
          address: true,
          serviceArea: true,
          verification: true,
          isDemo: true,
          category,
        },
      }),
      this.prisma.organization.count({ where }),
    ]);
    return { items, total, page: p, limit };
  }

  @Get('organizations/:slug')
  async organization(@Param('slug') slug: string) {
    const item = await this.prisma.organization.findFirst({
      where: { slug, status: 'published' },
      select: {
        id: true,
        slug: true,
        kind: true,
        name: true,
        description: true,
        services: true,
        phone: true,
        website: true,
        address: true,
        serviceArea: true,
        hours: true,
        hoursCheckedAt: true,
        verification: true,
        sourceName: true,
        sourceUrl: true,
        checkedAt: true,
        updatedAt: true,
        isDemo: true,
        ownerId: true,
        category,
      },
    });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND' });
    const { ownerId, ...rest } = item;
    return { ...rest, acceptsInquiries: ownerId !== null };
  }

  @Get('events')
  async events(@Query() query: unknown) {
    const { q, category: cat, when, page: p, limit } = parse(eventQuery, query);
    const now = new Date();
    const timeFilter: Prisma.EventWhereInput =
      when === 'upcoming'
        ? { OR: [{ endsAt: { gte: now } }, { endsAt: null, startsAt: { gte: now } }] }
        : { OR: [{ endsAt: { lt: now } }, { endsAt: null, startsAt: { lt: now } }] };
    const where: Prisma.EventWhereInput = {
      status: { in: ['published', 'cancelled'] },
      AND: [timeFilter, textFilter(q, ['title', 'description'])],
      ...categoryFilter(cat),
    };
    const [items, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        orderBy: { startsAt: when === 'upcoming' ? 'asc' : 'desc' },
        skip: (p - 1) * limit,
        take: limit,
        select: {
          id: true,
          slug: true,
          title: true,
          location: true,
          startsAt: true,
          endsAt: true,
          status: true,
          capacity: true,
          isDemo: true,
          category,
        },
      }),
      this.prisma.event.count({ where }),
    ]);
    return { items, total, page: p, limit };
  }

  @Get('events/:slug')
  async event(@Param('slug') slug: string) {
    const item = await this.prisma.event.findFirst({
      where: { slug, status: { in: ['published', 'cancelled'] } },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        organizer: true,
        location: true,
        startsAt: true,
        endsAt: true,
        timezone: true,
        registrationUrl: true,
        capacity: true,
        status: true,
        isDemo: true,
        category,
        _count: { select: { registrations: true } },
      },
    });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND' });
    const { _count, ...rest } = item;
    return { ...rest, registered: _count.registrations };
  }

  @Get('directory')
  async directory(@Query() query: unknown) {
    const { q, category: cat } = parse(listQuery, query);
    return this.prisma.directoryEntry.findMany({
      where: { status: 'published', ...categoryFilter(cat), ...textFilter(q, ['title', 'body']) },
      orderBy: [{ position: 'asc' }, { title: 'asc' }],
      take: 200,
      select: {
        id: true,
        slug: true,
        title: true,
        kind: true,
        body: true,
        phone: true,
        url: true,
        sourceName: true,
        sourceUrl: true,
        checkedAt: true,
        isDemo: true,
        category,
      },
    });
  }

  @Get('home')
  async home() {
    const now = new Date();
    const [news, announcements, organizations, events, directory] = await Promise.all([
      this.prisma.newsArticle.findMany({
        where: { status: 'published' },
        orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
        take: 3,
        select: {
          slug: true,
          title: true,
          excerpt: true,
          publishedAt: true,
          isDemo: true,
          category,
        },
      }),
      this.prisma.announcement.findMany({
        where: publishedAnnouncement(now),
        orderBy: { publishedAt: 'desc' },
        take: 4,
        select: {
          slug: true,
          title: true,
          price: true,
          area: true,
          publishedAt: true,
          isDemo: true,
          category,
        },
      }),
      this.prisma.organization.findMany({
        where: { status: 'published' },
        orderBy: { updatedAt: 'desc' },
        take: 4,
        select: {
          slug: true,
          kind: true,
          name: true,
          serviceArea: true,
          address: true,
          verification: true,
          isDemo: true,
          category,
        },
      }),
      this.prisma.event.findMany({
        where: { status: 'published', startsAt: { gte: now } },
        orderBy: { startsAt: 'asc' },
        take: 3,
        select: { slug: true, title: true, location: true, startsAt: true, isDemo: true },
      }),
      this.prisma.directoryEntry.findMany({
        where: { status: 'published', kind: 'emergency' },
        orderBy: { position: 'asc' },
        take: 6,
        select: { slug: true, title: true, phone: true, isDemo: true },
      }),
    ]);
    return { news, announcements, organizations, events, directory };
  }

  /**
   * PostgreSQL FTS (russian stemming) with trigram/ILIKE fallback. Only content that is public
   * right now is searchable: published, not expired, open active groups; never drafts or private data.
   */
  @Get('search')
  async search(@Query() query: unknown) {
    const { q, type, category, sort, page, limit } = parse(searchQuery, query);
    const parts = this.searchParts(q, type, category);
    if (!parts.length) return { q, items: [], total: 0, page, limit };
    const order =
      sort === 'date'
        ? Prisma.sql`date DESC NULLS LAST, rank DESC`
        : Prisma.sql`rank DESC, date DESC NULLS LAST`;
    const rows = await this.prisma.$queryRaw<
      Array<{
        type: string;
        slug: string;
        title: string;
        snippet: string;
        date: Date | null;
        rank: number;
        total: bigint;
      }>
    >(
      Prisma.sql`SELECT *, count(*) OVER() AS total FROM (${Prisma.join(parts, ' UNION ALL ')}) AS results ORDER BY ${order} LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    );
    const total = Number(rows[0]?.total ?? 0);
    if (page === 1)
      await this.analytics.track('search', {
        module: type ?? 'all',
        query: sanitizeQuery(q),
        results: total,
      });
    return {
      q,
      items: rows.map(({ total: _total, ...r }) => ({ ...r, rank: Number(r.rank) })),
      total,
      page,
      limit,
    };
  }

  /** Title suggestions while typing; same visibility rules as search. */
  @Get('search/suggest')
  async suggest(@Query() query: unknown) {
    const { q } = parse(suggestQuery, query);
    const parts = this.searchParts(q);
    const rows = await this.prisma.$queryRaw<Array<{ type: string; slug: string; title: string }>>(
      Prisma.sql`SELECT type, slug, title FROM (${Prisma.join(parts, ' UNION ALL ')}) AS results WHERE type <> 'posts' ORDER BY rank DESC LIMIT 8`,
    );
    return { items: rows };
  }

  /** Public URLs for sitemap.xml — only what anonymous visitors can open. */
  @Get('sitemap')
  async sitemap() {
    const take = SITEMAP_LIMIT;
    const sel = { slug: true, updatedAt: true } as const;
    const orderBy = { updatedAt: 'desc' } as const;
    const now = new Date();
    const [news, announcements, organizations, services, events, jobs, lostFound, polls, groups] =
      await Promise.all([
        this.prisma.newsArticle.findMany({
          where: { status: 'published' },
          select: sel,
          orderBy,
          take,
        }),
        this.prisma.announcement.findMany({
          where: { status: 'published', expiresAt: { gt: now } },
          select: sel,
          orderBy,
          take,
        }),
        this.prisma.organization.findMany({
          where: { status: 'published', kind: 'organization' },
          select: sel,
          orderBy,
          take,
        }),
        this.prisma.organization.findMany({
          where: { status: 'published', kind: 'service' },
          select: sel,
          orderBy,
          take,
        }),
        this.prisma.event.findMany({
          where: { status: { in: ['published', 'cancelled'] } },
          select: sel,
          orderBy,
          take,
        }),
        this.prisma.job.findMany({
          where: { status: 'published', expiresAt: { gt: now } },
          select: sel,
          orderBy,
          take,
        }),
        this.prisma.lostFoundItem.findMany({
          where: { status: 'published', expiresAt: { gt: now } },
          select: sel,
          orderBy,
          take,
        }),
        this.prisma.poll.findMany({
          where: { status: 'published' },
          select: sel,
          orderBy,
          take,
        }),
        this.prisma.group.findMany({
          where: { status: 'active', visibility: 'open' },
          select: sel,
          orderBy,
          take,
        }),
      ]);
    return { news, announcements, organizations, services, events, jobs, lostFound, polls, groups };
  }

  private searchParts(q: string, type?: string, category?: string): Prisma.Sql[] {
    const parts: Prisma.Sql[] = [];
    const add = (t: string, sql: Prisma.Sql) => {
      if (type && type !== t) return;
      if (category && !CATEGORIZED.has(t)) return;
      parts.push(sql);
    };
    const rank = (title: Prisma.Sql) =>
      Prisma.sql`ts_rank("search", websearch_to_tsquery('russian', ${q})) + similarity(${title}, ${q})`;
    const match = (title: Prisma.Sql) =>
      Prisma.sql`("search" @@ websearch_to_tsquery('russian', ${q}) OR ${title} % ${q} OR ${title} ILIKE ${'%' + q + '%'})`;
    const cat = category
      ? Prisma.sql` AND category_id IN (SELECT id FROM categories WHERE slug = ${category})`
      : Prisma.empty;
    add(
      'news',
      Prisma.sql`SELECT 'news' AS type, slug, title, left(excerpt, 200) AS snippet, published_at AS date, ${rank(Prisma.sql`title`)} AS rank FROM news_articles WHERE status = 'published'${cat} AND ${match(Prisma.sql`title`)}`,
    );
    add(
      'announcements',
      Prisma.sql`SELECT 'announcements' AS type, slug, title, left(description, 200) AS snippet, published_at AS date, ${rank(Prisma.sql`title`)} AS rank FROM announcements WHERE status = 'published' AND expires_at > now()${cat} AND ${match(Prisma.sql`title`)}`,
    );
    for (const [t, kind] of [
      ['organizations', 'organization'],
      ['services', 'service'],
    ] as const)
      add(
        t,
        Prisma.sql`SELECT ${t} AS type, slug, name AS title, left(description, 200) AS snippet, updated_at AS date, ${rank(Prisma.sql`name`)} AS rank FROM organizations WHERE status = 'published' AND kind = ${kind}${cat} AND ${match(Prisma.sql`name`)}`,
      );
    add(
      'events',
      Prisma.sql`SELECT 'events' AS type, slug, title, left(description, 200) AS snippet, starts_at AS date, ${rank(Prisma.sql`title`)} AS rank FROM events WHERE status IN ('published', 'cancelled')${cat} AND ${match(Prisma.sql`title`)}`,
    );
    add(
      'directory',
      Prisma.sql`SELECT 'directory' AS type, slug, title, left(body, 200) AS snippet, updated_at AS date, ${rank(Prisma.sql`title`)} AS rank FROM directory_entries WHERE status = 'published'${cat} AND ${match(Prisma.sql`title`)}`,
    );
    add(
      'jobs',
      Prisma.sql`SELECT 'jobs' AS type, slug, title, left(description, 200) AS snippet, published_at AS date, ${rank(Prisma.sql`title`)} AS rank FROM jobs WHERE status = 'published' AND expires_at > now() AND ${match(Prisma.sql`title`)}`,
    );
    add(
      'lost_found',
      Prisma.sql`SELECT 'lost_found' AS type, slug, title, left(description, 200) AS snippet, published_at AS date, ${rank(Prisma.sql`title`)} AS rank FROM lost_found WHERE status = 'published' AND expires_at > now() AND ${match(Prisma.sql`title`)}`,
    );
    add(
      'groups',
      Prisma.sql`SELECT 'groups' AS type, slug, name AS title, left(description, 200) AS snippet, created_at AS date, ${rank(Prisma.sql`name`)} AS rank FROM groups WHERE status = 'active' AND ${match(Prisma.sql`name`)}`,
    );
    // Posts: only the general feed and open active groups; closed-group posts are never searchable.
    add(
      'posts',
      Prisma.sql`SELECT 'posts' AS type, p.id::text AS slug, left(p.body, 80) AS title, left(p.body, 200) AS snippet, p.published_at AS date, ts_rank(p."search", websearch_to_tsquery('russian', ${q})) AS rank FROM posts p LEFT JOIN groups g ON g.id = p.group_id WHERE p.status = 'published' AND (p.group_id IS NULL OR (g.status = 'active' AND g.visibility = 'open')) AND (p."search" @@ websearch_to_tsquery('russian', ${q}) OR p.body ILIKE ${'%' + q + '%'})`,
    );
    return parts;
  }
}
