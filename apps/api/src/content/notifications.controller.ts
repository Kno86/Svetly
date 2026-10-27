import { Body, Controller, Get, HttpCode, Injectable, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { Authenticated, CurrentPrincipal } from '../auth/guards.js';
import type { Principal } from '../auth/principal.js';
import { parse } from '../common/validation.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Service categories are always delivered; the user may switch off only non-essential ones. */
export const NOTIFICATION_CATEGORIES = {
  moderation: { label: 'Модерация моих материалов', optional: false },
  comments: { label: 'Комментарии и ответы', optional: true },
  groups: { label: 'Группы', optional: true },
  issues: { label: 'Мои обращения', optional: false },
  business: { label: 'Бизнес: заявки и проверка карточки', optional: false },
  system: { label: 'Системные', optional: false },
} as const;
export type NotificationCategory = keyof typeof NOTIFICATION_CATEGORIES;

/** Titles are fixed strings: notifications never copy third-party text (comments, names, messages). */
export const NOTIFICATIONS = {
  post_comment: { title: 'Новый комментарий к вашему посту', category: 'comments' },
  comment_reply: { title: 'Ответ на ваш комментарий', category: 'comments' },
  post_approved: { title: 'Ваш пост опубликован', category: 'moderation' },
  post_rejected: { title: 'Пост отклонён модератором', category: 'moderation' },
  post_removed: { title: 'Пост снят модератором', category: 'moderation' },
  comment_removed: { title: 'Комментарий снят модератором', category: 'moderation' },
  publication_approved: { title: 'Ваша публикация одобрена', category: 'moderation' },
  publication_rejected: { title: 'Публикация отклонена модератором', category: 'moderation' },
  publication_unpublished: { title: 'Публикация снята модератором', category: 'moderation' },
  group_approved: { title: 'Ваша группа одобрена', category: 'groups' },
  group_rejected: { title: 'Группа отклонена модератором', category: 'groups' },
  group_archived: { title: 'Группа отправлена в архив', category: 'groups' },
  group_join_request: { title: 'Новая заявка на вступление в группу', category: 'groups' },
  group_join_approved: { title: 'Заявка в группу принята', category: 'groups' },
  issue_status: { title: 'Изменился статус вашего обращения', category: 'issues' },
  business_inquiry: { title: 'Новая заявка для вашей организации', category: 'business' },
  business_reviewed: { title: 'Проверка карточки организации завершена', category: 'business' },
} as const satisfies Record<string, { title: string; category: NotificationCategory }>;
export type NotificationType = keyof typeof NOTIFICATIONS;
export const NOTIFICATION_PAGE = 30;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates in-app notifications; the acting user never notifies themselves, opted-out users of an
   * optional category are skipped, and a `dedupeKey` makes retries and repeated triggers idempotent.
   */
  async notify(
    userIds: Iterable<string>,
    type: NotificationType,
    href: string,
    actorId?: string,
    dedupeKey?: string,
  ) {
    let ids = [...new Set(userIds)].filter((id) => id !== actorId);
    if (!ids.length) return;
    const { title, category } = NOTIFICATIONS[type];
    if (NOTIFICATION_CATEGORIES[category].optional) {
      const off = await this.prisma.notificationPreference.findMany({
        where: { userId: { in: ids }, category, enabled: false },
        select: { userId: true },
      });
      const muted = new Set(off.map((o) => o.userId));
      ids = ids.filter((id) => !muted.has(id));
      if (!ids.length) return;
    }
    await this.prisma.notification.createMany({
      data: ids.map((userId) => ({ userId, type, title, category, href, dedupeKey })),
      skipDuplicates: true,
    });
  }
}

const categoryEnum = z.enum(
  Object.keys(NOTIFICATION_CATEGORIES) as [NotificationCategory, ...NotificationCategory[]],
);
const listQuery = z.object({
  cursor: z.uuid().optional(),
  category: categoryEnum.optional(),
  unread: z.enum(['1']).optional(),
});
const readBody = z.object({
  ids: z.array(z.uuid()).max(100).optional(),
  category: categoryEnum.optional(),
});
const settingsBody = z.object({ categories: z.record(z.string(), z.boolean()) });

@Controller('me')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('notifications')
  @Authenticated()
  async list(@Query() query: unknown, @CurrentPrincipal() p: Principal) {
    const { cursor, category, unread } = parse(listQuery, query);
    const [rows, counts] = await Promise.all([
      this.prisma.notification.findMany({
        where: {
          userId: p.userId,
          ...(category ? { category } : {}),
          ...(unread ? { readAt: null } : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: NOTIFICATION_PAGE + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          type: true,
          category: true,
          title: true,
          href: true,
          readAt: true,
          createdAt: true,
        },
      }),
      this.prisma.notification.groupBy({
        by: ['category'],
        where: { userId: p.userId, readAt: null },
        _count: { _all: true },
      }),
    ]);
    const items = rows.slice(0, NOTIFICATION_PAGE);
    return {
      items,
      nextCursor: rows.length > NOTIFICATION_PAGE ? items[items.length - 1]!.id : null,
      unread: Object.fromEntries(counts.map((c) => [c.category, c._count._all])),
    };
  }

  /** Marks the given notifications (or a whole category, or all) as read; only the owner's rows are touched. */
  @Post('notifications/read')
  @Authenticated()
  @HttpCode(200)
  async read(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const { ids, category } = parse(readBody, body ?? {});
    const { count } = await this.prisma.notification.updateMany({
      where: {
        userId: p.userId,
        readAt: null,
        ...(ids ? { id: { in: ids } } : {}),
        ...(category ? { category } : {}),
      },
      data: { readAt: new Date() },
    });
    return { updated: count };
  }

  @Get('notification-settings')
  @Authenticated()
  async settings(@CurrentPrincipal() p: Principal) {
    const prefs = await this.prisma.notificationPreference.findMany({
      where: { userId: p.userId },
    });
    const off = new Set(prefs.filter((x) => !x.enabled).map((x) => x.category));
    return {
      categories: Object.entries(NOTIFICATION_CATEGORIES).map(([key, c]) => ({
        key,
        label: c.label,
        optional: c.optional,
        enabled: !c.optional || !off.has(key),
      })),
      channels: { inApp: true, email: false, push: false, telegram: false },
    };
  }

  /** Only optional categories can be switched off; service notifications stay on. */
  @Put('notification-settings')
  @Authenticated()
  async update(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const { categories } = parse(settingsBody, body);
    const entries = Object.entries(categories).filter(
      ([k]) => NOTIFICATION_CATEGORIES[k as NotificationCategory]?.optional,
    );
    await this.prisma.$transaction(
      entries.map(([category, enabled]) =>
        this.prisma.notificationPreference.upsert({
          where: { userId_category: { userId: p.userId, category } },
          create: { userId: p.userId, category, enabled },
          update: { enabled },
        }),
      ),
    );
    return this.settings(p);
  }
}
