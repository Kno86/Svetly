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
  type Type,
} from '@nestjs/common';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { Authenticated, CurrentPrincipal, RequirePermission } from '../auth/guards.js';
import type { Principal } from '../auth/principal.js';
import { parse } from '../common/validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.controller.js';
import { trustedThreshold } from './announcements.controller.js';
import { uniqueSlug } from './slug.js';

type Row = Record<string, unknown>;
/** Structural subset shared by the `job` and `lostFoundItem` Prisma delegates. */
interface Delegate {
  count(args: { where: object }): Promise<number>;
  findMany(args: object): Promise<Row[]>;
  findFirst(args: object): Promise<Row | null>;
  create(args: object): Promise<Row>;
  update(args: object): Promise<Row>;
  updateMany(args: object): Promise<{ count: number }>;
}

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{6,20}$/, 'Некорректный телефон')
  .nullable()
  .optional();
const optText = (max: number) => z.string().trim().max(max).nullable().optional();

const jobBody = z.object({
  title: z.string().trim().min(3).max(120),
  employer: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(5000),
  conditions: z.string().trim().max(3000).default(''),
  requirements: z.string().trim().max(3000).default(''),
  salary: optText(120),
  schedule: optText(120),
  area: optText(120),
  contactPhone: phone,
  contactNote: optText(300),
  ttlDays: z.number().int().min(7).max(60).default(30),
  imageIds: z.array(z.uuid()).max(6).default([]),
});
const lostFoundBody = z.object({
  kind: z.enum(['lost', 'found']),
  subject: z.enum(['item', 'animal']),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(3000),
  area: optText(120),
  happenedOn: z.iso.date().nullable().optional(),
  imageIds: z.array(z.uuid()).max(6).default([]),
  contactPhone: phone,
});
const listQuery = z.object({
  q: z.string().trim().max(200).optional(),
  kind: z.enum(['lost', 'found']).optional(),
  subject: z.enum(['item', 'animal']).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});
const queueQuery = z.object({
  status: z.enum(['pending', 'published', 'rejected']).default('pending'),
});
const noteBody = z.object({ note: z.string().trim().max(500).optional() });

interface KindConfig {
  path: 'jobs' | 'lost-found';
  entity: 'job' | 'lost_found';
  delegate: (p: PrismaService) => Delegate;
  body: z.ZodType<Row>;
  ttlDays: number;
  text: string[];
  listSelect: Record<string, true>;
  /** Author-side final statuses besides "closed" (e.g. lost & found "resolved"). */
  finalActions: Array<'close' | 'resolve'>;
}

const JOB: KindConfig = {
  path: 'jobs',
  entity: 'job',
  delegate: (p) => p.job as unknown as Delegate,
  body: jobBody,
  ttlDays: 30,
  text: ['title', 'employer', 'description'],
  listSelect: {
    id: true,
    slug: true,
    title: true,
    employer: true,
    salary: true,
    schedule: true,
    area: true,
    imageIds: true,
    publishedAt: true,
    expiresAt: true,
  },
  finalActions: ['close'],
};
const LOST_FOUND: KindConfig = {
  path: 'lost-found',
  entity: 'lost_found',
  delegate: (p) => p.lostFoundItem as unknown as Delegate,
  body: lostFoundBody,
  ttlDays: 60,
  text: ['title', 'description'],
  listSelect: {
    id: true,
    slug: true,
    kind: true,
    subject: true,
    title: true,
    area: true,
    happenedOn: true,
    imageIds: true,
    publishedAt: true,
    expiresAt: true,
  },
  finalActions: ['close', 'resolve'],
};
const MAX_PENDING = 10;

/** Author is trusted after N approved posts across all resident modules with no rejections. */
export async function isTrustedAuthor(prisma: PrismaService, authorId: string): Promise<boolean> {
  const approved = { authorId, publishedAt: { not: null } };
  const rejectedOrRemoved = { authorId, status: { in: ['rejected', 'removed'] } };
  const [a, j, l, posts, rejected] = await Promise.all([
    prisma.announcement.count({ where: approved }),
    prisma.job.count({ where: approved }),
    prisma.lostFoundItem.count({ where: approved }),
    prisma.post.count({ where: approved }),
    Promise.all([
      prisma.announcement.count({ where: { authorId, status: 'rejected' } }),
      prisma.job.count({ where: { authorId, status: 'rejected' } }),
      prisma.lostFoundItem.count({ where: { authorId, status: 'rejected' } }),
      prisma.post.count({ where: rejectedOrRemoved }),
    ]).then((r) => r.reduce((x, y) => x + y, 0)),
  ]);
  return a + j + l + posts >= (await trustedThreshold(prisma)) && rejected === 0;
}

function communityController(cfg: KindConfig): Type<unknown> {
  const { path, entity } = cfg;

  @Controller()
  class CommunityController {
    constructor(
      readonly prisma: PrismaService,
      readonly audit: AuditService,
      readonly notifications: NotificationsService,
    ) {}

    get db() {
      return cfg.delegate(this.prisma);
    }

    published(now = new Date()) {
      return { status: 'published', expiresAt: { gt: now } };
    }

    async checkImages(userId: string, ids: string[] | undefined) {
      if (!ids?.length) return;
      const owned = await this.prisma.mediaAsset.count({
        where: { id: { in: ids }, ownerId: userId },
      });
      if (owned !== new Set(ids).size)
        throw new BadRequestException({
          code: 'INVALID_MEDIA',
          message: 'Можно прикреплять только свои изображения',
        });
    }

    toData(raw: Row) {
      const { ttlDays, happenedOn, ...rest } = raw as Row & {
        ttlDays?: number;
        happenedOn?: string | null;
      };
      return {
        data: {
          ...rest,
          ...(happenedOn !== undefined
            ? { happenedOn: happenedOn ? new Date(happenedOn) : null }
            : {}),
        },
        ttl: ttlDays ?? cfg.ttlDays,
      };
    }

    log(
      action: string,
      actorId: string,
      id: string,
      metadata: Record<string, string | boolean> = {},
    ) {
      return this.audit.record({
        action: `${entity}.${action}`,
        outcome: 'success',
        actorId,
        entityType: entity,
        entityId: id,
        metadata,
      });
    }

    @Get(path)
    async list(@Query() query: unknown) {
      const { q, kind, subject, page, limit } = parse(listQuery, query);
      const where = {
        ...this.published(),
        ...(entity === 'lost_found'
          ? { ...(kind ? { kind } : {}), ...(subject ? { subject } : {}) }
          : {}),
        ...(q ? { OR: cfg.text.map((f) => ({ [f]: { contains: q, mode: 'insensitive' } })) } : {}),
      };
      const [items, total] = await Promise.all([
        this.db.findMany({
          where,
          orderBy: { publishedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: cfg.listSelect,
        }),
        this.db.count({ where }),
      ]);
      return { items, total, page, limit };
    }

    /** Contact phone appears only on the published detail page, never in lists. */
    @Get(`${path}/:slug`)
    async detail(@Param('slug') slug: string) {
      const item = await this.db.findFirst({
        where: { slug, ...this.published() },
        omit: { authorId: true, moderationNote: true },
      });
      if (!item) throw new NotFoundException({ code: 'NOT_FOUND' });
      return item;
    }

    @Get(`me/${path}`)
    @Authenticated()
    mine(@CurrentPrincipal() p: Principal) {
      return this.db.findMany({
        where: { authorId: p.userId },
        orderBy: { createdAt: 'desc' },
        select: { ...cfg.listSelect, status: true, moderationNote: true, createdAt: true },
      });
    }

    @Get(`me/${path}/:id`)
    @Authenticated()
    async mineOne(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: Principal) {
      const item = await this.db.findFirst({ where: { id, authorId: p.userId } });
      if (!item) throw new NotFoundException({ code: 'NOT_FOUND' });
      return item;
    }

    @Post(path)
    @Authenticated()
    async create(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
      const parsed = parse(cfg.body, body);
      await this.checkImages(p.userId, parsed.imageIds as string[] | undefined);
      if (
        (await this.db.count({ where: { authorId: p.userId, status: 'pending' } })) >= MAX_PENDING
      )
        throw new BadRequestException({
          code: 'TOO_MANY_PENDING',
          message: 'Слишком много публикаций ждут проверки',
        });
      const trusted = await isTrustedAuthor(this.prisma, p.userId);
      const { data, ttl } = this.toData(parsed);
      const now = new Date();
      const item = await this.db.create({
        data: {
          ...data,
          slug: uniqueSlug(String((data as Row).title)),
          authorId: p.userId,
          status: trusted ? 'published' : 'pending',
          publishedAt: trusted ? now : null,
          expiresAt: new Date(now.getTime() + ttl * 86_400_000),
        },
        select: { id: true, slug: true, status: true },
      });
      await this.log('created', p.userId, String(item.id), {
        status: String(item.status),
        premoderated: !trusted,
      });
      return item;
    }

    @Patch(`${path}/:id`)
    @Authenticated()
    async update(
      @Param('id', ParseUUIDPipe) id: string,
      @Body() body: unknown,
      @CurrentPrincipal() p: Principal,
    ) {
      const parsed = parse(cfg.body, body);
      const existing = await this.db.findFirst({ where: { id, authorId: p.userId } });
      if (!existing) throw new NotFoundException({ code: 'NOT_FOUND' });
      if (!['pending', 'published', 'rejected'].includes(String(existing.status)))
        throw new BadRequestException({
          code: 'NOT_EDITABLE',
          message: 'Закрытую публикацию нельзя изменить',
        });
      await this.checkImages(p.userId, parsed.imageIds as string[] | undefined);
      const trusted = await isTrustedAuthor(this.prisma, p.userId);
      const status = trusted && existing.status === 'published' ? 'published' : 'pending';
      const { data } = this.toData(parsed);
      const item = await this.db.update({
        where: { id },
        data: { ...data, status, moderationNote: null },
        select: { id: true, slug: true, status: true },
      });
      await this.log('updated', p.userId, id, { status });
      return item;
    }

    @Post(`${path}/:id/:action`)
    @HttpCode(204)
    @Authenticated()
    async finish(
      @Param('id', ParseUUIDPipe) id: string,
      @Param('action') action: string,
      @CurrentPrincipal() p: Principal,
    ) {
      if (!(cfg.finalActions as string[]).includes(action))
        throw new NotFoundException({ code: 'NOT_FOUND' });
      const status = action === 'resolve' ? 'resolved' : 'closed';
      const from = action === 'resolve' ? ['published'] : ['pending', 'published', 'rejected'];
      const { count } = await this.db.updateMany({
        where: { id, authorId: p.userId, status: { in: from } },
        data: { status },
      });
      if (!count) throw new NotFoundException({ code: 'NOT_FOUND' });
      await this.log(status, p.userId, id);
    }

    @Get(`moderation/${path}`)
    @RequirePermission('moderation.community')
    queue(@Query() query: unknown) {
      const { status } = parse(queueQuery, query);
      return this.db.findMany({ where: { status }, orderBy: { createdAt: 'asc' }, take: 100 });
    }

    @Post(`moderation/${path}/:id/:decision`)
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
      const target = (await this.db.findFirst({
        where: { id },
        select: { authorId: true, slug: true },
      })) as { authorId: string; slug: string } | null;
      const { count } = await this.db.updateMany({
        where: { id, status: { in: decision === 'unpublish' ? ['published'] : ['pending'] } },
        data:
          decision === 'approve'
            ? { status: 'published', publishedAt: new Date(), moderationNote: null }
            : { status: 'rejected', moderationNote: note },
      });
      if (!count) throw new NotFoundException({ code: 'NOT_FOUND' });
      await this.audit.record({
        action: `moderation.${entity}_${decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'unpublished'}`,
        outcome: 'success',
        actorId: p.userId,
        entityType: entity,
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
          decision === 'approve' ? `/${path}/${target.slug}` : '/account/community',
          p.userId,
        );
    }
  }
  Object.defineProperty(CommunityController, 'name', { value: `${entity}Controller` });
  return CommunityController;
}

export const JobsController = communityController(JOB);
export const LostFoundController = communityController(LOST_FOUND);
