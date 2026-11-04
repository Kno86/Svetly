import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import {
  Authenticated,
  CurrentPrincipal,
  OptionalAuth,
  OptionalPrincipal,
  RequirePermission,
} from '../auth/guards.js';
import type { Principal } from '../auth/principal.js';
import { parse } from '../common/validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.controller.js';

const reviewBody = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(20).max(2000),
});
const noteBody = z.object({ note: z.string().trim().max(1000).optional() });
/** An average of one or two opinions is misleading; below this only the count is shown. */
export const MIN_REVIEWS_FOR_AVERAGE = 3;
const MAX_PENDING_PER_AUTHOR = 5;
const PAGE = 50;

/**
 * Premoderated organization reviews (docs/BUSINESS.md). Residents write one review per
 * organization; it is public only after a moderator with `moderation.community` approves it.
 */
@Controller()
export class ReviewsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get('organizations/:id/reviews')
  @OptionalAuth()
  async list(@Param('id', ParseUUIDPipe) id: string, @OptionalPrincipal() p?: Principal) {
    const org = await this.prisma.organization.findFirst({
      where: { id, status: 'published' },
      select: { ownerId: true },
    });
    if (!org) throw new NotFoundException({ code: 'NOT_FOUND' });
    const published = { organizationId: id, status: 'published' };
    const [agg, rows, mine] = await Promise.all([
      this.prisma.organizationReview.aggregate({
        where: published,
        _count: true,
        _avg: { rating: true },
      }),
      this.prisma.organizationReview.findMany({
        where: published,
        orderBy: { publishedAt: 'desc' },
        take: PAGE,
        select: {
          id: true,
          rating: true,
          body: true,
          publishedAt: true,
          author: {
            select: { id: true, name: true, residentProfile: { select: { isPublic: true } } },
          },
        },
      }),
      p
        ? this.prisma.organizationReview.findUnique({
            where: { organizationId_authorId: { organizationId: id, authorId: p.userId } },
            select: { rating: true, body: true, status: true, moderationNote: true },
          })
        : null,
    ]);
    const count = agg._count;
    return {
      summary: {
        count,
        average:
          count >= MIN_REVIEWS_FOR_AVERAGE ? Math.round((agg._avg.rating ?? 0) * 10) / 10 : null,
      },
      items: rows.map(({ author, ...r }) => ({
        ...r,
        author: {
          name: author.name,
          profileId: author.residentProfile?.isPublic ? author.id : null,
        },
      })),
      mine,
      canReview: Boolean(p) && org.ownerId !== p?.userId,
    };
  }

  /** Creates the caller's review or resubmits it after edits; either way it goes back to moderation. */
  @Post('organizations/:id/reviews')
  @HttpCode(200)
  @Authenticated()
  async submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    const data = parse(reviewBody, body);
    const org = await this.prisma.organization.findFirst({
      where: { id, status: 'published' },
      select: { ownerId: true },
    });
    if (!org) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (org.ownerId === p.userId)
      throw new ForbiddenException({
        code: 'OWN_ORGANIZATION',
        message: 'Нельзя оставить отзыв о своей организации',
      });
    const pending = await this.prisma.organizationReview.count({
      where: { authorId: p.userId, status: 'pending', organizationId: { not: id } },
    });
    if (pending >= MAX_PENDING_PER_AUTHOR)
      throw new BadRequestException({
        code: 'TOO_MANY_PENDING',
        message: 'Дождитесь проверки уже отправленных отзывов',
      });
    const reset = { ...data, status: 'pending', moderationNote: null, publishedAt: null };
    const review = await this.prisma.organizationReview.upsert({
      where: { organizationId_authorId: { organizationId: id, authorId: p.userId } },
      create: { ...data, organizationId: id, authorId: p.userId },
      update: reset,
      select: { id: true, status: true },
    });
    await this.audit.record({
      action: 'review.submitted',
      outcome: 'success',
      actorId: p.userId,
      entityType: 'review',
      entityId: review.id,
      metadata: { organizationId: id },
    });
    return review;
  }

  @Delete('organizations/:id/reviews/mine')
  @HttpCode(204)
  @Authenticated()
  async withdraw(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: Principal) {
    const review = await this.prisma.organizationReview.findUnique({
      where: { organizationId_authorId: { organizationId: id, authorId: p.userId } },
      select: { id: true },
    });
    if (!review) throw new NotFoundException({ code: 'NOT_FOUND' });
    await this.prisma.organizationReview.delete({ where: { id: review.id } });
    await this.audit.record({
      action: 'review.withdrawn',
      outcome: 'success',
      actorId: p.userId,
      entityType: 'review',
      entityId: review.id,
    });
  }

  @Post('moderation/reviews/:id/:decision')
  @HttpCode(204)
  @RequirePermission('moderation.community')
  async decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('decision') decision: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    if (!['approve', 'reject', 'unpublish'].includes(decision))
      throw new NotFoundException({ code: 'NOT_FOUND' });
    const { note } = parse(noteBody, body ?? {});
    if (decision !== 'approve' && !note)
      throw new BadRequestException({
        code: 'NOTE_REQUIRED',
        message: 'Укажите причину для автора',
      });
    const target = await this.prisma.organizationReview.findUnique({
      where: { id },
      select: { authorId: true, organization: { select: { slug: true } } },
    });
    const { count } = await this.prisma.organizationReview.updateMany({
      where: { id, status: decision === 'unpublish' ? 'published' : 'pending' },
      data:
        decision === 'approve'
          ? { status: 'published', publishedAt: new Date(), moderationNote: null }
          : { status: 'rejected', publishedAt: null, moderationNote: note },
    });
    if (!count || !target) throw new NotFoundException({ code: 'NOT_FOUND' });
    const past =
      decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'unpublished';
    await this.audit.record({
      action: `moderation.review_${past}`,
      outcome: 'success',
      actorId: p.userId,
      entityType: 'review',
      entityId: id,
      metadata: note ? { note } : {},
    });
    await this.notifications.notify(
      [target.authorId],
      `review_${past}`,
      `/organizations/${target.organization.slug}#reviews`,
      p.userId,
    );
  }
}
