import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { setting } from './settings.js';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { Authenticated, CurrentPrincipal, RequirePermission } from '../auth/guards.js';
import type { Principal } from '../auth/principal.js';
import { parse } from '../common/validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.controller.js';
import { uniqueSlug } from './slug.js';

const announcementBody = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(10).max(5000),
  categoryId: z.uuid(),
  price: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  condition: z.enum(['new', 'used']).nullable().optional(),
  area: z.string().trim().max(120).nullable().optional(),
  contactPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{6,20}$/, 'Некорректный телефон')
    .nullable()
    .optional(),
  imageIds: z.array(z.uuid()).max(6).default([]),
});
const moderationBody = z.object({ note: z.string().trim().max(500).optional() });
const queueQuery = z.object({
  status: z.enum(['pending', 'published', 'rejected']).default('pending'),
});

/** Number of approved announcements after which an author is no longer premoderated (admin-configurable setting). */
export const trustedThreshold = (prisma: PrismaService) =>
  setting(prisma, 'moderation.trustedThreshold');

@Controller()
export class AnnouncementsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private async validateRefs(userId: string, categoryId: string, imageIds: string[]) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, module: 'announcements', active: true },
    });
    if (!category)
      throw new BadRequestException({
        code: 'INVALID_CATEGORY',
        message: 'Выберите категорию объявлений',
      });
    if (imageIds.length) {
      const owned = await this.prisma.mediaAsset.count({
        where: { id: { in: imageIds }, ownerId: userId },
      });
      if (owned !== new Set(imageIds).size) {
        throw new BadRequestException({
          code: 'INVALID_MEDIA',
          message: 'Можно прикреплять только свои изображения',
        });
      }
    }
  }

  @Get('me/announcements')
  @Authenticated()
  mine(@CurrentPrincipal() principal: Principal) {
    return this.prisma.announcement.findMany({
      where: { authorId: principal.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        moderationNote: true,
        price: true,
        publishedAt: true,
        expiresAt: true,
        createdAt: true,
        category: { select: { slug: true, name: true } },
      },
    });
  }

  @Get('me/announcements/:id')
  @Authenticated()
  async mineOne(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() principal: Principal) {
    const item = await this.prisma.announcement.findFirst({
      where: { id, authorId: principal.userId },
    });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND' });
    return item;
  }

  @Post('announcements')
  @Authenticated()
  async create(@Body() body: unknown, @CurrentPrincipal() principal: Principal) {
    const data = parse(announcementBody, body);
    await this.validateRefs(principal.userId, data.categoryId, data.imageIds);
    const pending = await this.prisma.announcement.count({
      where: { authorId: principal.userId, status: 'pending' },
    });
    if (pending >= (await setting(this.prisma, 'announcements.maxPending'))) {
      throw new BadRequestException({
        code: 'TOO_MANY_PENDING',
        message: 'Слишком много объявлений ждут проверки',
      });
    }
    const approved = await this.prisma.announcement.count({
      where: {
        authorId: principal.userId,
        status: { in: ['published', 'closed', 'archived'] },
        publishedAt: { not: null },
      },
    });
    const rejected = await this.prisma.announcement.count({
      where: { authorId: principal.userId, status: 'rejected' },
    });
    const trusted = approved >= (await trustedThreshold(this.prisma)) && rejected === 0;
    const now = new Date();
    const item = await this.prisma.announcement.create({
      data: {
        ...data,
        slug: uniqueSlug(data.title),
        authorId: principal.userId,
        status: trusted ? 'published' : 'pending',
        publishedAt: trusted ? now : null,
        expiresAt: new Date(
          now.getTime() + (await setting(this.prisma, 'announcements.ttlDays')) * 86_400_000,
        ),
      },
      select: { id: true, slug: true, status: true },
    });
    await this.audit.record({
      action: 'announcement.created',
      outcome: 'success',
      actorId: principal.userId,
      entityType: 'announcement',
      entityId: item.id,
      metadata: { status: item.status, premoderated: !trusted },
    });
    return item;
  }

  /** Editing a published announcement of a non-trusted author sends it back to moderation. */
  @Patch('announcements/:id')
  @Authenticated()
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentPrincipal() principal: Principal,
  ) {
    const data = parse(announcementBody, body);
    const existing = await this.prisma.announcement.findFirst({
      where: { id, authorId: principal.userId },
    });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (!['pending', 'published', 'rejected'].includes(existing.status)) {
      throw new BadRequestException({
        code: 'NOT_EDITABLE',
        message: 'Закрытое объявление нельзя изменить',
      });
    }
    await this.validateRefs(principal.userId, data.categoryId, data.imageIds);
    const approved = await this.prisma.announcement.count({
      where: {
        authorId: principal.userId,
        status: { in: ['published', 'closed', 'archived'] },
        publishedAt: { not: null },
      },
    });
    const trusted = approved >= (await trustedThreshold(this.prisma));
    const status = trusted && existing.status === 'published' ? 'published' : 'pending';
    const item = await this.prisma.announcement.update({
      where: { id },
      data: { ...data, status, moderationNote: null },
      select: { id: true, slug: true, status: true },
    });
    await this.audit.record({
      action: 'announcement.updated',
      outcome: 'success',
      actorId: principal.userId,
      entityType: 'announcement',
      entityId: id,
      metadata: { status },
    });
    return item;
  }

  @Post('announcements/:id/close')
  @HttpCode(204)
  @Authenticated()
  async close(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() principal: Principal) {
    const result = await this.prisma.announcement.updateMany({
      where: {
        id,
        authorId: principal.userId,
        status: { in: ['pending', 'published', 'rejected'] },
      },
      data: { status: 'closed' },
    });
    if (result.count === 0) throw new NotFoundException({ code: 'NOT_FOUND' });
    await this.audit.record({
      action: 'announcement.closed',
      outcome: 'success',
      actorId: principal.userId,
      entityType: 'announcement',
      entityId: id,
    });
  }

  @Get('moderation/announcements')
  @RequirePermission('moderation.announcements')
  queue(@Query() query: unknown) {
    const { status } = parse(queueQuery, query);
    return this.prisma.announcement.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        price: true,
        area: true,
        contactPhone: true,
        imageIds: true,
        status: true,
        moderationNote: true,
        createdAt: true,
        authorId: true,
        category: { select: { name: true } },
      },
    });
  }

  @Post('moderation/announcements/:id/:decision')
  @HttpCode(204)
  @RequirePermission('moderation.announcements')
  async decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('decision') decision: string,
    @Body() body: unknown,
    @CurrentPrincipal() principal: Principal,
  ) {
    if (!['approve', 'reject', 'unpublish'].includes(decision))
      throw new NotFoundException({ code: 'NOT_FOUND' });
    const { note } = parse(moderationBody, body ?? {});
    if (decision !== 'approve' && !note) {
      throw new BadRequestException({
        code: 'NOTE_REQUIRED',
        message: 'Укажите причину для автора',
      });
    }
    const from = decision === 'unpublish' ? ['published'] : ['pending'];
    const now = new Date();
    const target = await this.prisma.announcement.findUnique({
      where: { id },
      select: { authorId: true, slug: true },
    });
    const result = await this.prisma.announcement.updateMany({
      where: { id, status: { in: from } },
      data:
        decision === 'approve'
          ? { status: 'published', publishedAt: now, moderationNote: null }
          : { status: 'rejected', moderationNote: note },
    });
    if (result.count === 0) throw new NotFoundException({ code: 'NOT_FOUND' });
    await this.audit.record({
      action: `moderation.announcement_${decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'unpublished'}`,
      outcome: 'success',
      actorId: principal.userId,
      entityType: 'announcement',
      entityId: id,
      metadata: note ? { note } : {},
    });
    if (target)
      await this.notifications.notify(
        [target.authorId],
        decision === 'approve'
          ? 'publication_approved'
          : decision === 'reject'
            ? 'publication_rejected'
            : 'publication_unpublished',
        decision === 'approve' ? `/announcements/${target.slug}` : '/account/announcements',
        principal.userId,
      );
  }
}
