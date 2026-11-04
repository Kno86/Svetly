import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { clientIp } from '../auth/auth.service.js';
import { Authenticated, CurrentPrincipal } from '../auth/guards.js';
import { verifyPassword } from '../auth/password.js';
import type { Principal } from '../auth/principal.js';
import { parse } from '../common/validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { type FileStorage, LocalFileStorage } from './storage.service.js';

const deleteBody = z.object({
  password: z.string().min(1).max(128),
  confirm: z.literal('УДАЛИТЬ'),
});

/** Failed password checks per user before self-deletion is paused. */
const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

/**
 * Self-service personal data export and account deletion (152-ФЗ: access to and deletion of
 * one's own personal data). Rules are documented in docs/ACCOUNT_DELETION.md.
 */
@Controller('me')
@Authenticated()
export class AccountController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(LocalFileStorage) private readonly storage: FileStorage,
  ) {}

  @Get('export')
  async export(@CurrentPrincipal() p: Principal, @Res({ passthrough: true }) reply: FastifyReply) {
    const userId = p.userId;
    const db = this.prisma;
    const [
      user,
      roles,
      announcements,
      jobs,
      lostFound,
      issues,
      posts,
      comments,
      groupsCreated,
      groupMemberships,
      reactions,
      favorites,
      pollVotes,
      eventRegistrations,
      complaints,
      inquiriesSent,
      organizations,
      messagesSent,
      notificationPreferences,
      interests,
      media,
      profile,
      reviews,
    ] = await Promise.all([
      db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { id: true, name: true, email: true, emailVerified: true, createdAt: true },
      }),
      db.userRole.findMany({ where: { userId }, select: { roleCode: true, grantedAt: true } }),
      db.announcement.findMany({ where: { authorId: userId } }),
      db.job.findMany({ where: { authorId: userId } }),
      db.lostFoundItem.findMany({ where: { authorId: userId } }),
      db.issue.findMany({ where: { reporterId: userId }, include: { updates: true } }),
      db.post.findMany({ where: { authorId: userId } }),
      db.comment.findMany({ where: { authorId: userId } }),
      db.group.findMany({ where: { createdById: userId } }),
      db.groupMember.findMany({ where: { userId } }),
      db.postReaction.findMany({ where: { userId } }),
      db.favorite.findMany({ where: { userId } }),
      db.pollVote.findMany({ where: { userId } }),
      db.eventRegistration.findMany({ where: { userId } }),
      db.complaint.findMany({ where: { reporterId: userId } }),
      db.businessInquiry.findMany({ where: { senderId: userId } }),
      db.organization.findMany({ where: { ownerId: userId } }),
      // Only the user's own messages: other participants' texts are their personal data.
      db.message.findMany({
        where: { senderId: userId },
        select: { id: true, conversationId: true, body: true, mediaIds: true, createdAt: true },
      }),
      db.notificationPreference.findMany({ where: { userId } }),
      db.userInterest.findMany({ where: { userId } }),
      db.mediaAsset.findMany({
        where: { ownerId: userId },
        select: { id: true, mime: true, size: true, alt: true, private: true, createdAt: true },
      }),
      db.residentProfile.findUnique({ where: { userId } }),
      db.organizationReview.findMany({ where: { authorId: userId } }),
    ]);
    await this.audit.record({
      action: 'account.exported',
      outcome: 'success',
      actorId: userId,
      entityType: 'user',
      entityId: userId,
    });
    reply.header('content-disposition', 'attachment; filename="svetly-my-data.json"');
    reply.header('cache-control', 'no-store');
    return {
      exportedAt: new Date().toISOString(),
      note: 'Ваши данные в SVETLY. Тексты других пользователей не включены.',
      user,
      roles,
      announcements,
      jobs,
      lostFound,
      issues,
      posts,
      comments,
      groupsCreated,
      groupMemberships,
      reactions,
      favorites,
      pollVotes,
      eventRegistrations,
      complaints,
      inquiriesSent,
      organizations,
      messagesSent,
      notificationPreferences,
      interests,
      media,
      profile,
      reviews,
    };
  }

  @Post('delete')
  @HttpCode(200)
  async remove(
    @CurrentPrincipal() p: Principal,
    @Body() body: unknown,
    @Req() req: FastifyRequest,
  ) {
    const { password } = parse(deleteBody, body);
    const userId = p.userId;
    const meta = {
      ipAddress: clientIp(
        new Headers({ 'x-forwarded-for': String(req.headers['x-forwarded-for'] ?? '') }),
      ),
      requestId: String(req.id),
    };

    const failures = await this.prisma.auditLog.count({
      where: {
        actorId: userId,
        action: 'account.deleted',
        outcome: 'failure',
        occurredAt: { gte: new Date(Date.now() - FAILURE_WINDOW_MS) },
      },
    });
    if (failures >= MAX_FAILURES)
      throw new HttpException(
        { code: 'TOO_MANY_ATTEMPTS', message: 'Слишком много попыток. Повторите через 15 минут.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );

    const account = await this.prisma.account.findFirst({
      where: { userId, providerId: 'credential' },
      select: { password: true },
    });
    if (!account?.password || !(await verifyPassword({ hash: account.password, password }))) {
      await this.audit.record({
        action: 'account.deleted',
        outcome: 'failure',
        actorId: userId,
        entityType: 'user',
        entityId: userId,
        metadata: { reason: 'wrong_password' },
        ...meta,
      });
      throw new ForbiddenException({ code: 'WRONG_PASSWORD', message: 'Неверный пароль' });
    }
    // Staff accounts must lose their roles first, so the platform never deletes its last admin.
    if (p.roles.length)
      throw new ConflictException({
        code: 'STAFF_ACCOUNT',
        message: 'У учётной записи есть служебные роли. Сначала их должен снять администратор.',
      });

    const mediaKeys = await this.prisma.$transaction(async (tx) => {
      // Content without a foreign key to users is removed or detached explicitly.
      await tx.announcement.deleteMany({ where: { authorId: userId } });
      await tx.job.deleteMany({ where: { authorId: userId } });
      await tx.lostFoundItem.deleteMany({ where: { authorId: userId } });
      const issues = await tx.issue.findMany({
        where: { reporterId: userId },
        select: { id: true },
      });
      await tx.issueUpdate.deleteMany({ where: { issueId: { in: issues.map((i) => i.id) } } });
      await tx.issue.deleteMany({ where: { reporterId: userId } });
      await tx.issueUpdate.updateMany({ where: { authorId: userId }, data: { authorId: null } });
      await tx.complaint.deleteMany({ where: { reporterId: userId } });
      await tx.businessInquiry.deleteMany({ where: { senderId: userId } });
      await tx.pollVote.deleteMany({ where: { userId } });
      await tx.eventRegistration.deleteMany({ where: { userId } });
      await tx.favorite.deleteMany({ where: { userId } });
      await tx.postReaction.deleteMany({ where: { userId } });

      // Business cards: unpublished applications go away, published cards stay in the
      // catalogue without an owner so staff can keep or archive them.
      await tx.organization.deleteMany({
        where: { ownerId: userId, status: { not: 'published' } },
      });
      await tx.organization.updateMany({
        where: { ownerId: userId },
        data: { ownerId: null, pendingChanges: Prisma.DbNull, submittedAt: null },
      });
      await tx.organization.updateMany({
        where: { createdById: userId },
        data: { createdById: null },
      });

      // Groups the user created pass to the longest-standing active member; empty ones are removed.
      const groups = await tx.group.findMany({
        where: { createdById: userId },
        select: { id: true },
      });
      for (const g of groups) {
        const heir = await tx.groupMember.findFirst({
          where: { groupId: g.id, userId: { not: userId }, status: 'active' },
          orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
          select: { id: true, userId: true },
        });
        if (heir) {
          await tx.group.update({ where: { id: g.id }, data: { createdById: heir.userId } });
          await tx.groupMember.update({ where: { id: heir.id }, data: { role: 'owner' } });
        } else await tx.group.delete({ where: { id: g.id } });
      }
      // Conversations keep the other participant's history; only the creator id is detached.
      const other = await tx.conversation.findMany({
        where: { createdById: userId },
        select: {
          id: true,
          members: { where: { userId: { not: userId } }, select: { userId: true } },
        },
      });
      for (const c of other) {
        const next = c.members[0]?.userId;
        if (next)
          await tx.conversation.update({ where: { id: c.id }, data: { createdById: next } });
        else await tx.conversation.delete({ where: { id: c.id } });
      }

      const media = await tx.mediaAsset.findMany({
        where: { ownerId: userId },
        select: { storageKey: true },
      });
      await tx.mediaAsset.deleteMany({ where: { ownerId: userId } });
      // Sessions, accounts, posts, comments, messages, memberships, notifications etc. cascade.
      await tx.user.delete({ where: { id: userId } });
      return media.map((m) => m.storageKey);
    });
    await Promise.all(mediaKeys.map((key) => this.storage.remove(key)));

    await this.audit.record({
      action: 'account.deleted',
      outcome: 'success',
      actorId: userId,
      entityType: 'user',
      entityId: userId,
      metadata: { media: mediaKeys.length },
      ...meta,
    });
    return { deleted: true };
  }
}
