import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { Authenticated, CurrentPrincipal } from '../auth/guards.js';
import type { Principal } from '../auth/principal.js';
import { parse } from '../common/validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isVisibleTarget, visiblePostWhere } from './visibility.js';

export const FAVORITE_TYPES = [
  'announcement',
  'news',
  'event',
  'organization',
  'job',
  'lost_found',
  'post',
] as const;
type FavoriteType = (typeof FAVORITE_TYPES)[number];
const MAX_FAVORITES = 500;

const favoriteBody = z.object({ entityType: z.enum(FAVORITE_TYPES), entityId: z.uuid() });
const PATHS: Record<FavoriteType, string> = {
  announcement: '/announcements',
  news: '/news',
  event: '/events',
  organization: '/organizations',
  job: '/jobs',
  lost_found: '/lost-found',
  post: '/feed',
};

/** Private bookmarks. Only currently visible items can be saved; hidden ones are listed as unavailable. */
@Controller()
export class FavoritesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me/favorites')
  @Authenticated()
  async list(@CurrentPrincipal() p: Principal) {
    const favs = await this.prisma.favorite.findMany({
      where: { userId: p.userId },
      orderBy: { createdAt: 'desc' },
      take: MAX_FAVORITES,
    });
    const resolved = await this.resolve(favs, p.userId);
    return favs.map((f) => {
      const r = resolved.get(`${f.entityType}:${f.entityId}`);
      return {
        entityType: f.entityType,
        entityId: f.entityId,
        createdAt: f.createdAt,
        available: !!r,
        title: r?.title ?? null,
        href: r ? `${PATHS[f.entityType as FavoriteType]}/${r.slug}` : null,
      };
    });
  }

  @Get('me/favorites/check')
  @Authenticated()
  async check(@Query() query: unknown, @CurrentPrincipal() p: Principal) {
    const { entityType, entityId } = parse(favoriteBody, query);
    const saved = await this.prisma.favorite.count({
      where: { userId: p.userId, entityType, entityId },
    });
    return { saved: saved > 0 };
  }

  @Post('favorites')
  @Authenticated()
  @HttpCode(200)
  async add(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const { entityType, entityId } = parse(favoriteBody, body);
    if (!(await isVisibleTarget(this.prisma, entityType, entityId, p.userId)))
      throw new NotFoundException({ code: 'NOT_FOUND' });
    const count = await this.prisma.favorite.count({ where: { userId: p.userId } });
    if (count >= MAX_FAVORITES)
      throw new NotFoundException({
        code: 'FAVORITES_LIMIT',
        message: 'Достигнут лимит избранного',
      });
    await this.prisma.favorite.upsert({
      where: { userId_entityType_entityId: { userId: p.userId, entityType, entityId } },
      create: { userId: p.userId, entityType, entityId },
      update: {},
    });
    return { saved: true };
  }

  @Delete('favorites/:entityType/:entityId')
  @Authenticated()
  async remove(
    @Param('entityType') type: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
    @CurrentPrincipal() p: Principal,
  ) {
    const entityType = parse(z.enum(FAVORITE_TYPES), type);
    await this.prisma.favorite.deleteMany({ where: { userId: p.userId, entityType, entityId } });
    return { saved: false };
  }

  private async resolve(favs: Array<{ entityType: string; entityId: string }>, userId: string) {
    const ids = (t: FavoriteType) => favs.filter((f) => f.entityType === t).map((f) => f.entityId);
    const now = new Date();
    const pub = (t: FavoriteType) => ({ id: { in: ids(t) }, status: 'published' });
    const live = (t: FavoriteType) => ({ ...pub(t), expiresAt: { gt: now } });
    const sel = { id: true, slug: true, title: true } as const;
    const [a, n, e, o, j, l, posts] = await Promise.all([
      this.prisma.announcement.findMany({ where: live('announcement'), select: sel }),
      this.prisma.newsArticle.findMany({ where: pub('news'), select: sel }),
      this.prisma.event.findMany({ where: pub('event'), select: sel }),
      this.prisma.organization.findMany({
        where: pub('organization'),
        select: { id: true, slug: true, name: true },
      }),
      this.prisma.job.findMany({ where: live('job'), select: sel }),
      this.prisma.lostFoundItem.findMany({ where: live('lost_found'), select: sel }),
      this.prisma.post.findMany({
        where: { id: { in: ids('post') }, ...visiblePostWhere(userId) },
        select: { id: true, body: true },
      }),
    ]);
    const map = new Map<string, { title: string; slug: string }>();
    const put = (t: FavoriteType, rows: Array<{ id: string; slug: string; title: string }>) =>
      rows.forEach((r) => map.set(`${t}:${r.id}`, { title: r.title, slug: r.slug }));
    put('announcement', a);
    put('news', n);
    put('event', e);
    put(
      'organization',
      o.map((r) => ({ id: r.id, slug: r.slug, title: r.name })),
    );
    put('job', j);
    put('lost_found', l);
    put(
      'post',
      posts.map((r) => ({ id: r.id, slug: r.id, title: r.body.slice(0, 80) })),
    );
    return map;
  }
}
