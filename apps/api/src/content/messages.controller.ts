import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { Authenticated, CurrentPrincipal } from '../auth/guards.js';
import type { Principal } from '../auth/principal.js';
import { parse } from '../common/validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isVisibleTarget } from './visibility.js';
import { Feature } from '../integrations/feature.guard.js';

export const MESSAGE_PAGE = 30;
const CONVERSATION_PAGE = 30;
const MAX_AFTER = 100;
export const MAX_MESSAGE_IMAGES = 3;
export const MESSAGE_LIMIT = { count: 20, windowMs: 60_000 };
export const NEW_CONVERSATION_LIMIT = { count: 10, windowMs: 24 * 3600_000 };

const startBody = z
  .object({ postId: z.uuid().optional(), commentId: z.uuid().optional() })
  .refine((b) => Boolean(b.postId) !== Boolean(b.commentId), {
    message: 'Укажите пост или комментарий',
  });
const messageBody = z
  .object({
    body: z.string().trim().max(2000).default(''),
    mediaIds: z.array(z.uuid()).max(MAX_MESSAGE_IMAGES).default([]),
    clientId: z
      .string()
      .regex(/^[A-Za-z0-9_-]{8,64}$/)
      .optional(),
  })
  .refine((m) => m.body.length > 0 || m.mediaIds.length > 0, { message: 'Пустое сообщение' });
const historyQuery = z.object({ before: z.uuid().optional(), after: z.uuid().optional() });
const listQuery = z.object({ cursor: z.uuid().optional() });

const messageSelect = {
  id: true,
  senderId: true,
  clientId: true,
  body: true,
  mediaIds: true,
  status: true,
  createdAt: true,
} as const;
type MessageRow = {
  id: string;
  senderId: string;
  clientId: string | null;
  body: string;
  mediaIds: string[];
  status: string;
  createdAt: Date;
};

const BLOCKED = {
  code: 'MESSAGING_BLOCKED',
  message: 'Отправка сообщений этому пользователю недоступна',
};

function presentMessage(m: MessageRow, viewer: string) {
  const deleted = m.status === 'deleted';
  return {
    id: m.id,
    mine: m.senderId === viewer,
    body: deleted ? '' : m.body,
    mediaIds: deleted ? [] : m.mediaIds,
    deleted,
    createdAt: m.createdAt,
    ...(m.senderId === viewer ? { clientId: m.clientId } : {}),
  };
}

const tooMany = (message: string) =>
  new HttpException({ code: 'RATE_LIMITED', message }, HttpStatus.TOO_MANY_REQUESTS);

/**
 * Direct 1:1 messages. Delivery is not realtime: clients poll. Message contents are never
 * written to the audit log or application logs.
 */
@Controller()
@Feature('chats')
export class MessagesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('me/conversations')
  @Authenticated()
  async conversations(@Query() query: unknown, @CurrentPrincipal() p: Principal) {
    const { cursor } = parse(listQuery, query);
    const rows = await this.prisma.conversation.findMany({
      where: { lastMessageAt: { not: null }, members: { some: { userId: p.userId } } },
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      take: CONVERSATION_PAGE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        lastMessageAt: true,
        members: { select: { userId: true, user: { select: { name: true } } } },
        messages: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: messageSelect,
        },
      },
    });
    const items = rows.slice(0, CONVERSATION_PAGE);
    const unread = await this.unreadBy(
      p.userId,
      items.map((c) => c.id),
    );
    return {
      items: items.map((c) => {
        const other = c.members.find((m) => m.userId !== p.userId);
        const last = c.messages[0];
        return {
          id: c.id,
          other: other ? { id: other.userId, name: other.user.name } : null,
          lastMessageAt: c.lastMessageAt,
          last: last
            ? {
                mine: last.senderId === p.userId,
                deleted: last.status === 'deleted',
                preview: last.status === 'deleted' ? '' : last.body.slice(0, 120),
                images: last.status === 'deleted' ? 0 : last.mediaIds.length,
              }
            : null,
          unread: unread.get(c.id) ?? 0,
        };
      }),
      nextCursor: rows.length > CONVERSATION_PAGE ? items[items.length - 1]!.id : null,
    };
  }

  @Get('me/unread')
  @Authenticated()
  async unread(@CurrentPrincipal() p: Principal) {
    const [rows, notifications] = await Promise.all([
      this.prisma.$queryRaw<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM messages m
        JOIN conversation_members cm
          ON cm.conversation_id = m.conversation_id AND cm.user_id = ${p.userId}::uuid
        WHERE m.sender_id <> ${p.userId}::uuid AND m.status = 'sent'
          AND m.created_at > cm.last_read_at`,
      this.prisma.notification.count({ where: { userId: p.userId, readAt: null } }),
    ]);
    return { messages: rows[0]?.n ?? 0, notifications };
  }

  /** Opens (or reuses) a conversation with the author of a post or comment the caller can see. */
  @Post('conversations')
  @Authenticated()
  @HttpCode(200)
  async start(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const data = parse(startBody, body);
    const targetId = await this.authorOf(data, p.userId);
    if (!targetId) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (targetId === p.userId)
      throw new BadRequestException({
        code: 'CANNOT_MESSAGE_SELF',
        message: 'Нельзя написать самому себе',
      });
    const pairKey = [p.userId, targetId].sort().join(':');
    const existing = await this.prisma.conversation.findUnique({
      where: { pairKey },
      select: { id: true },
    });
    if (existing) return existing;
    if (!(await this.canMessage(p.userId, targetId))) throw new ForbiddenException(BLOCKED);
    const recent = await this.prisma.conversation.count({
      where: {
        createdById: p.userId,
        createdAt: { gt: new Date(Date.now() - NEW_CONVERSATION_LIMIT.windowMs) },
      },
    });
    if (recent >= NEW_CONVERSATION_LIMIT.count)
      throw tooMany('Слишком много новых диалогов за сутки, попробуйте позже');
    try {
      const c = await this.prisma.conversation.create({
        data: {
          pairKey,
          createdById: p.userId,
          members: { create: [{ userId: p.userId }, { userId: targetId }] },
        },
        select: { id: true },
      });
      await this.log('conversation.created', p.userId, 'conversation', c.id);
      return c;
    } catch (e) {
      if ((e as { code?: string }).code !== 'P2002') throw e;
      return this.prisma.conversation.findUniqueOrThrow({
        where: { pairKey },
        select: { id: true },
      });
    }
  }

  @Get('conversations/:id')
  @Authenticated()
  async conversation(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: Principal) {
    const { otherId } = await this.membership(id, p.userId);
    const [other, blockedByMe, canSend] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: otherId }, select: { id: true, name: true } }),
      this.prisma.userBlock.count({ where: { blockerId: p.userId, blockedId: otherId } }),
      this.canMessage(p.userId, otherId),
    ]);
    return { id, other, blockedByMe: blockedByMe > 0, canSend };
  }

  /** History, newest page first (`before` = older page cursor); `after` returns newer messages for polling. */
  @Get('conversations/:id/messages')
  @Authenticated()
  async history(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    const { before, after } = parse(historyQuery, query);
    await this.membership(id, p.userId);
    if (after) {
      const ref = await this.prisma.message.findFirst({
        where: { id: after, conversationId: id },
        select: { createdAt: true },
      });
      if (!ref) throw new BadRequestException({ code: 'INVALID_CURSOR' });
      const rows = await this.prisma.message.findMany({
        where: {
          conversationId: id,
          OR: [
            { createdAt: { gt: ref.createdAt } },
            { createdAt: ref.createdAt, id: { gt: after } },
          ],
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: MAX_AFTER,
        select: messageSelect,
      });
      return { items: rows.map((m) => presentMessage(m, p.userId)), nextBefore: null };
    }
    const rows = await this.prisma.message.findMany({
      where: { conversationId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MESSAGE_PAGE + 1,
      ...(before ? { cursor: { id: before }, skip: 1 } : {}),
      select: messageSelect,
    });
    const page = rows.slice(0, MESSAGE_PAGE);
    return {
      items: page.reverse().map((m) => presentMessage(m, p.userId)),
      nextBefore: rows.length > MESSAGE_PAGE ? page[0]!.id : null,
    };
  }

  @Post('conversations/:id/messages')
  @Authenticated()
  @HttpCode(201)
  async send(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    const data = parse(messageBody, body);
    const { otherId } = await this.membership(id, p.userId);
    if (data.clientId) {
      const prior = await this.prisma.message.findUnique({
        where: { senderId_clientId: { senderId: p.userId, clientId: data.clientId } },
        select: { ...messageSelect, conversationId: true },
      });
      if (prior) {
        if (prior.conversationId !== id) throw new ConflictException({ code: 'CLIENT_ID_REUSED' });
        return presentMessage(prior, p.userId);
      }
    }
    if (!(await this.canMessage(p.userId, otherId))) throw new ForbiddenException(BLOCKED);
    const recent = await this.prisma.message.count({
      where: {
        senderId: p.userId,
        createdAt: { gt: new Date(Date.now() - MESSAGE_LIMIT.windowMs) },
      },
    });
    if (recent >= MESSAGE_LIMIT.count)
      throw tooMany('Слишком много сообщений подряд, подождите минуту');
    const ids = [...new Set(data.mediaIds)];
    if (ids.length) {
      const owned = await this.prisma.mediaAsset.count({
        where: { id: { in: ids }, ownerId: p.userId, private: true },
      });
      if (owned !== ids.length)
        throw new BadRequestException({
          code: 'INVALID_MEDIA',
          message: 'Можно прикреплять только свои изображения, загруженные для сообщения',
        });
    }
    const now = new Date();
    const [m] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId: id,
          senderId: p.userId,
          clientId: data.clientId ?? null,
          body: data.body,
          mediaIds: ids,
          createdAt: now,
        },
        select: messageSelect,
      }),
      this.prisma.conversation.update({ where: { id }, data: { lastMessageAt: now } }),
      this.prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId: id, userId: p.userId } },
        data: { lastReadAt: now },
      }),
    ]);
    return presentMessage(m, p.userId);
  }

  @Post('conversations/:id/read')
  @Authenticated()
  @HttpCode(200)
  async markRead(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: Principal) {
    await this.membership(id, p.userId);
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId: id, userId: p.userId } },
      data: { lastReadAt: new Date() },
    });
    return { ok: true };
  }

  /** Sender-only soft delete; text and attachments are erased, not just hidden. */
  @Delete('messages/:id')
  @Authenticated()
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: Principal) {
    const { count } = await this.prisma.message.updateMany({
      where: { id, senderId: p.userId, status: 'sent' },
      data: { status: 'deleted', body: '', mediaIds: [] },
    });
    if (!count) throw new NotFoundException({ code: 'NOT_FOUND' });
    await this.log('message.deleted', p.userId, 'message', id);
    return { id, status: 'deleted' };
  }

  // ---------------------------------------------------------------- blocks
  @Get('me/blocks')
  @Authenticated()
  async blocks(@CurrentPrincipal() p: Principal) {
    const rows = await this.prisma.userBlock.findMany({
      where: { blockerId: p.userId },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { blockedId: true, createdAt: true, blocked: { select: { name: true } } },
    });
    return rows.map((r) => ({ userId: r.blockedId, name: r.blocked.name, createdAt: r.createdAt }));
  }

  /** Only conversation partners can be blocked, so the endpoint cannot be used to probe user IDs. */
  @Post('users/:id/block')
  @Authenticated()
  @HttpCode(200)
  async block(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: Principal) {
    if (id === p.userId || !(await this.isPartner(p.userId, id)))
      throw new NotFoundException({ code: 'NOT_FOUND' });
    await this.prisma.userBlock.createMany({
      data: [{ blockerId: p.userId, blockedId: id }],
      skipDuplicates: true,
    });
    await this.log('user.blocked', p.userId, 'user', id);
    return { userId: id, blocked: true };
  }

  @Delete('users/:id/block')
  @Authenticated()
  async unblock(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: Principal) {
    const { count } = await this.prisma.userBlock.deleteMany({
      where: { blockerId: p.userId, blockedId: id },
    });
    if (count) await this.log('user.unblocked', p.userId, 'user', id);
    return { userId: id, blocked: false };
  }

  // ---------------------------------------------------------------- helpers
  private async membership(conversationId: string, userId: string) {
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    if (!members.some((m) => m.userId === userId))
      throw new NotFoundException({ code: 'NOT_FOUND' });
    return { otherId: members.find((m) => m.userId !== userId)?.userId ?? userId };
  }

  private async canMessage(userId: string, otherId: string) {
    const [blocks, other] = await Promise.all([
      this.prisma.userBlock.count({
        where: {
          OR: [
            { blockerId: userId, blockedId: otherId },
            { blockerId: otherId, blockedId: userId },
          ],
        },
      }),
      this.prisma.user.findUnique({ where: { id: otherId }, select: { blockedAt: true } }),
    ]);
    return blocks === 0 && Boolean(other) && !other!.blockedAt && otherId !== userId;
  }

  private async isPartner(userId: string, otherId: string) {
    return (
      (await this.prisma.conversation.count({
        where: { pairKey: [userId, otherId].sort().join(':') },
      })) > 0
    );
  }

  private async authorOf(data: { postId?: string; commentId?: string }, userId: string) {
    if (data.postId) {
      if (!(await isVisibleTarget(this.prisma, 'post', data.postId, userId))) return null;
      return (await this.prisma.post.findUnique({ where: { id: data.postId } }))?.authorId ?? null;
    }
    if (!(await isVisibleTarget(this.prisma, 'comment', data.commentId!, userId))) return null;
    return (
      (await this.prisma.comment.findUnique({ where: { id: data.commentId! } }))?.authorId ?? null
    );
  }

  private async unreadBy(userId: string, ids: string[]) {
    if (!ids.length) return new Map<string, number>();
    const rows = await this.prisma.$queryRaw<Array<{ conversation_id: string; n: number }>>`
      SELECT m.conversation_id, count(*)::int AS n FROM messages m
      JOIN conversation_members cm
        ON cm.conversation_id = m.conversation_id AND cm.user_id = ${userId}::uuid
      WHERE m.conversation_id = ANY(${ids}::uuid[])
        AND m.sender_id <> ${userId}::uuid AND m.status = 'sent'
        AND m.created_at > cm.last_read_at
      GROUP BY m.conversation_id`;
    return new Map(rows.map((r) => [r.conversation_id, r.n]));
  }

  private log(action: string, actorId: string, entityType: string, entityId: string) {
    return this.audit.record({ action, outcome: 'success', actorId, entityType, entityId });
  }
}
