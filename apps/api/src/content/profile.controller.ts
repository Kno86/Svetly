import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { Authenticated, CurrentPrincipal } from '../auth/guards.js';
import type { Principal } from '../auth/principal.js';
import { parse } from '../common/validation.js';
import { PrismaService } from '../prisma/prisma.service.js';

const profileBody = z.object({
  isPublic: z.boolean(),
  bio: z.string().trim().max(500),
});
const RECENT_POSTS = 20;

/**
 * Opt-in public resident profile. Hidden by default; only the name, a short bio, the month of
 * registration, open groups and posts that are already public anywhere are shown. Never email,
 * roles, closed groups or activity in them.
 */
@Controller()
export class ProfileController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('me/profile')
  @Authenticated()
  async mine(@CurrentPrincipal() p: Principal) {
    const row = await this.prisma.residentProfile.findUnique({ where: { userId: p.userId } });
    return { id: p.userId, isPublic: row?.isPublic ?? false, bio: row?.bio ?? '' };
  }

  @Put('me/profile')
  @Authenticated()
  async update(@CurrentPrincipal() p: Principal, @Body() body: unknown) {
    const data = parse(profileBody, body);
    const row = await this.prisma.residentProfile.upsert({
      where: { userId: p.userId },
      create: { userId: p.userId, ...data },
      update: data,
    });
    await this.audit.record({
      action: 'profile.update',
      outcome: 'success',
      actorId: p.userId,
      entityType: 'user',
      entityId: p.userId,
      metadata: { isPublic: String(row.isPublic) },
    });
    return { id: p.userId, isPublic: row.isPublic, bio: row.bio };
  }

  @Get('residents/:id')
  async show(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, blockedAt: null, residentProfile: { isPublic: true } },
      select: { id: true, name: true, createdAt: true, residentProfile: { select: { bio: true } } },
    });
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Профиль не найден' });
    const openGroup = { status: 'active', visibility: 'open' };
    const [groups, posts] = await Promise.all([
      this.prisma.group.findMany({
        where: { ...openGroup, members: { some: { userId: id, status: 'active' } } },
        orderBy: { name: 'asc' },
        select: { slug: true, name: true },
      }),
      this.prisma.post.findMany({
        where: {
          authorId: id,
          status: 'published',
          OR: [{ groupId: null }, { group: openGroup }],
        },
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        take: RECENT_POSTS,
        select: {
          id: true,
          body: true,
          publishedAt: true,
          group: { select: { slug: true, name: true } },
        },
      }),
    ]);
    return {
      id: user.id,
      name: user.name,
      bio: user.residentProfile?.bio ?? '',
      memberSince: user.createdAt.toISOString().slice(0, 7),
      groups,
      posts: posts.map((post) => ({
        ...post,
        body: post.body.length > 280 ? `${post.body.slice(0, 279)}…` : post.body,
      })),
    };
  }
}
