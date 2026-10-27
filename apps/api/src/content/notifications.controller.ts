import { Body, Controller, Get, HttpCode, Injectable, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { Authenticated, CurrentPrincipal } from '../auth/guards.js';
import type { Principal } from '../auth/principal.js';
import { parse } from '../common/validation.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Titles are fixed strings: notifications never copy third-party text (comments, names, messages). */
export const NOTIFICATION_TITLES = {
  post_comment: 'Новый комментарий к вашему посту',
  comment_reply: 'Ответ на ваш комментарий',
  post_approved: 'Ваш пост опубликован',
  post_rejected: 'Пост отклонён модератором',
  post_removed: 'Пост снят модератором',
  comment_removed: 'Комментарий снят модератором',
  group_approved: 'Ваша группа одобрена',
  group_rejected: 'Группа отклонена модератором',
  group_archived: 'Группа отправлена в архив',
  group_join_request: 'Новая заявка на вступление в группу',
  group_join_approved: 'Заявка в группу принята',
} as const;
export type NotificationType = keyof typeof NOTIFICATION_TITLES;
export const NOTIFICATION_PAGE = 30;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates in-app notifications; the acting user never notifies themselves. */
  async notify(userIds: Iterable<string>, type: NotificationType, href: string, actorId?: string) {
    const ids = [...new Set(userIds)].filter((id) => id !== actorId);
    if (!ids.length) return;
    await this.prisma.notification.createMany({
      data: ids.map((userId) => ({ userId, type, title: NOTIFICATION_TITLES[type], href })),
    });
  }
}

const listQuery = z.object({ cursor: z.uuid().optional() });
const readBody = z.object({ ids: z.array(z.uuid()).max(100).optional() });

@Controller('me/notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Authenticated()
  async list(@Query() query: unknown, @CurrentPrincipal() p: Principal) {
    const { cursor } = parse(listQuery, query);
    const rows = await this.prisma.notification.findMany({
      where: { userId: p.userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: NOTIFICATION_PAGE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, type: true, title: true, href: true, readAt: true, createdAt: true },
    });
    const items = rows.slice(0, NOTIFICATION_PAGE);
    return {
      items,
      nextCursor: rows.length > NOTIFICATION_PAGE ? items[items.length - 1]!.id : null,
    };
  }

  /** Marks the given notifications (or all of them) as read; only the owner's rows are touched. */
  @Post('read')
  @Authenticated()
  @HttpCode(200)
  async read(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const { ids } = parse(readBody, body ?? {});
    const { count } = await this.prisma.notification.updateMany({
      where: { userId: p.userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });
    return { updated: count };
  }
}
