import { Body, Controller, Delete, Get, HttpCode, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { Authenticated, CurrentPrincipal } from '../auth/guards.js';
import type { Principal } from '../auth/principal.js';
import { parse } from '../common/validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { type Candidate, rank } from './recommendations.js';
import { Feature } from '../integrations/feature.guard.js';

export const INTEREST_MODULES = ['news', 'announcements', 'events', 'organizations'] as const;
const interestsBody = z.object({ categoryIds: z.array(z.uuid()).max(50) });
const hideBody = z.object({
  entityType: z.enum(['news', 'announcement', 'event']),
  entityId: z.uuid(),
});
const category = { select: { id: true, name: true } } as const;

@Controller('me')
@Feature('recommendations')
export class RecommendationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('interests')
  @Authenticated()
  async interests(@CurrentPrincipal() p: Principal) {
    const [cats, mine] = await Promise.all([
      this.prisma.category.findMany({
        where: { active: true, module: { in: [...INTEREST_MODULES] } },
        orderBy: [{ module: 'asc' }, { position: 'asc' }, { name: 'asc' }],
        select: { id: true, module: true, name: true },
      }),
      this.prisma.userInterest.findMany({ where: { userId: p.userId } }),
    ]);
    const selected = new Set(mine.map((m) => m.categoryId));
    return { categories: cats.map((c) => ({ ...c, selected: selected.has(c.id) })) };
  }

  @Put('interests')
  @Authenticated()
  async setInterests(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const { categoryIds } = parse(interestsBody, body);
    const valid = await this.prisma.category.findMany({
      where: { id: { in: categoryIds }, active: true, module: { in: [...INTEREST_MODULES] } },
      select: { id: true },
    });
    await this.prisma.$transaction([
      this.prisma.userInterest.deleteMany({ where: { userId: p.userId } }),
      this.prisma.userInterest.createMany({
        data: valid.map((c) => ({ userId: p.userId, categoryId: c.id })),
      }),
    ]);
    return this.interests(p);
  }

  /** Only published, current public content; the user's own selections drive the ranking. */
  @Get('recommendations')
  @Authenticated()
  async recommendations(@CurrentPrincipal() p: Principal) {
    const now = new Date();
    const since = new Date(now.getTime() - 30 * 86_400_000);
    const until = new Date(now.getTime() + 30 * 86_400_000);
    const [news, ads, events, mine, hidden] = await Promise.all([
      this.prisma.newsArticle.findMany({
        where: { status: 'published', publishedAt: { gte: since, lte: now } },
        orderBy: { publishedAt: 'desc' },
        take: 50,
        select: { id: true, slug: true, title: true, publishedAt: true, category },
      }),
      this.prisma.announcement.findMany({
        where: { status: 'published', publishedAt: { gte: since }, expiresAt: { gt: now } },
        orderBy: { publishedAt: 'desc' },
        take: 50,
        select: { id: true, slug: true, title: true, publishedAt: true, category },
      }),
      this.prisma.event.findMany({
        where: { status: 'published', startsAt: { gte: now, lte: until } },
        orderBy: { startsAt: 'asc' },
        take: 50,
        select: { id: true, slug: true, title: true, startsAt: true, category },
      }),
      this.prisma.userInterest.findMany({ where: { userId: p.userId } }),
      this.prisma.hiddenItem.findMany({ where: { userId: p.userId } }),
    ]);
    const candidates: Candidate[] = [
      ...news.map((n) => ({ type: 'news' as const, ...n, date: n.publishedAt! })),
      ...ads.map((a) => ({ type: 'announcement' as const, ...a, date: a.publishedAt! })),
      ...events.map((e) => ({ type: 'event' as const, ...e, date: e.startsAt })),
    ];
    const items = rank(
      candidates.map(({ type, id, slug, title, date, category: c }) => ({
        type,
        id,
        slug,
        title,
        date,
        category: c,
      })),
      new Set(mine.map((m) => m.categoryId)),
      new Set(hidden.map((h) => `${h.entityType}:${h.entityId}`)),
      now,
    );
    return { items, interests: mine.length, hidden: hidden.length };
  }

  @Post('recommendations/hidden')
  @Authenticated()
  @HttpCode(200)
  async hide(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const { entityType, entityId } = parse(hideBody, body);
    await this.prisma.hiddenItem.upsert({
      where: { userId_entityType_entityId: { userId: p.userId, entityType, entityId } },
      create: { userId: p.userId, entityType, entityId },
      update: {},
    });
    return { hidden: true };
  }

  @Delete('recommendations/hidden')
  @Authenticated()
  async unhideAll(@CurrentPrincipal() p: Principal) {
    const { count } = await this.prisma.hiddenItem.deleteMany({ where: { userId: p.userId } });
    return { restored: count };
  }
}
