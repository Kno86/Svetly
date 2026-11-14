import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Feature } from '../integrations/feature.guard.js';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { Authenticated, CurrentPrincipal, RequirePermission } from '../auth/guards.js';
import type { Principal } from '../auth/principal.js';
import { parse } from '../common/validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.controller.js';

export const ISSUE_CATEGORIES = [
  'roads',
  'lighting',
  'waste',
  'water',
  'landscaping',
  'safety',
  'other',
] as const;
export const ISSUE_STATUSES = [
  'received',
  'reviewing',
  'assigned',
  'in_progress',
  'resolved',
  'closed',
  'rejected',
] as const;
const FINAL = ['resolved', 'closed', 'rejected'];
const MAX_OPEN_PER_REPORTER = 10;

const issueBody = z.object({
  category: z.enum(ISSUE_CATEGORIES),
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(10).max(5000),
  address: z.string().trim().max(200).nullable().optional(),
  imageIds: z.array(z.uuid()).max(6).default([]),
  isPublic: z.boolean().default(false),
  contact: z.string().trim().max(200).nullable().optional(),
});
const publicQuery = z.object({
  status: z.enum(ISSUE_STATUSES).optional(),
  category: z.enum(ISSUE_CATEGORIES).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});
const staffQuery = z.object({
  status: z.enum(ISSUE_STATUSES).optional(),
  category: z.enum(ISSUE_CATEGORIES).optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  mine: z.enum(['1']).optional(),
});
const patchBody = z
  .object({
    status: z.enum(ISSUE_STATUSES).optional(),
    priority: z.enum(['low', 'normal', 'high']).optional(),
    assigneeId: z.uuid().nullable().optional(),
    note: z.string().trim().max(2000).optional(),
  })
  .refine((v) => v.status || v.priority || v.assigneeId !== undefined, 'Нет изменений');
const commentBody = z.object({
  body: z.string().trim().min(2).max(5000),
  public: z.boolean().default(false),
});

const publicFields = {
  number: true,
  category: true,
  title: true,
  description: true,
  address: true,
  imageIds: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;
const publicUpdates = {
  where: { internal: false },
  orderBy: { createdAt: 'asc' },
  select: { kind: true, fromStatus: true, toStatus: true, body: true, createdAt: true },
} as const;

/**
 * Territory issues. Reports go to SVETLY staff only — nothing is forwarded to the municipality automatically.
 * Public listing requires the reporter's explicit consent (`isPublic`) and never exposes reporter identity or contact.
 */
@Controller()
export class IssuesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  @Feature('issues')
  @Post('issues')
  @Authenticated()
  async create(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const data = parse(issueBody, body);
    if (data.imageIds.length) {
      const owned = await this.prisma.mediaAsset.count({
        where: { id: { in: data.imageIds }, ownerId: p.userId },
      });
      if (owned !== new Set(data.imageIds).size)
        throw new BadRequestException({
          code: 'INVALID_MEDIA',
          message: 'Можно прикреплять только свои изображения',
        });
    }
    const open = await this.prisma.issue.count({
      where: { reporterId: p.userId, status: { notIn: FINAL } },
    });
    if (open >= MAX_OPEN_PER_REPORTER)
      throw new BadRequestException({
        code: 'TOO_MANY_OPEN',
        message: 'У вас много открытых обращений',
      });
    const item = await this.prisma.issue.create({
      data: {
        ...data,
        reporterId: p.userId,
        updates: { create: { kind: 'created', toStatus: 'received', authorId: p.userId } },
      },
      select: { id: true, number: true, status: true },
    });
    await this.log('created', p.userId, item.id, { number: item.number, isPublic: data.isPublic });
    return item;
  }

  @Get('me/issues')
  @Authenticated()
  mine(@CurrentPrincipal() p: Principal) {
    return this.prisma.issue.findMany({
      where: { reporterId: p.userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, ...publicFields, isPublic: true },
    });
  }

  @Get('me/issues/:id')
  @Authenticated()
  async mineOne(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: Principal) {
    const item = await this.prisma.issue.findFirst({
      where: { id, reporterId: p.userId },
      select: { id: true, ...publicFields, isPublic: true, contact: true, updates: publicUpdates },
    });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND' });
    return item;
  }

  @Feature('issues')
  @Get('issues')
  async list(@Query() query: unknown) {
    const { status, category, page, limit } = parse(publicQuery, query);
    const where = {
      isPublic: true,
      status: status && status !== 'rejected' ? status : { not: 'rejected' },
      ...(category ? { category } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.issue.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: publicFields,
      }),
      this.prisma.issue.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  @Feature('issues')
  @Get('issues/:number')
  async detail(@Param('number', ParseIntPipe) number: number) {
    const item = await this.prisma.issue.findFirst({
      where: { number, isPublic: true, status: { not: 'rejected' } },
      select: { ...publicFields, updates: publicUpdates },
    });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND' });
    return item;
  }

  @Get('admin/issues')
  @RequirePermission('issues.manage')
  staffList(@Query() query: unknown, @CurrentPrincipal() p: Principal) {
    const { status, category, priority, mine } = parse(staffQuery, query);
    return this.prisma.issue.findMany({
      where: {
        ...(status ? { status } : { status: { notIn: FINAL } }),
        ...(category ? { category } : {}),
        ...(priority ? { priority } : {}),
        ...(mine ? { assigneeId: p.userId } : {}),
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 200,
    });
  }

  @Get('admin/issues/:id')
  @RequirePermission('issues.manage')
  async staffOne(@Param('id', ParseUUIDPipe) id: string) {
    const item = await this.prisma.issue.findUnique({
      where: { id },
      include: { updates: { orderBy: { createdAt: 'asc' } } },
    });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND' });
    return item;
  }

  @Patch('admin/issues/:id')
  @RequirePermission('issues.manage')
  async change(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    const data = parse(patchBody, body);
    const issue = await this.prisma.issue.findUnique({ where: { id } });
    if (!issue) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (data.status === 'rejected' && (data.note?.length ?? 0) < 3)
      throw new BadRequestException({
        code: 'NOTE_REQUIRED',
        message: 'Объясните жителю причину отклонения',
      });
    if (data.assigneeId) {
      const staff = await this.prisma.userRole.count({ where: { userId: data.assigneeId } });
      if (!staff)
        throw new BadRequestException({
          code: 'INVALID_ASSIGNEE',
          message: 'Ответственным может быть только сотрудник',
        });
    }
    const updates: Array<{
      kind: string;
      fromStatus?: string;
      toStatus?: string;
      body?: string;
      internal: boolean;
      authorId: string;
    }> = [];
    if (data.status && data.status !== issue.status)
      updates.push({
        kind: 'status',
        fromStatus: issue.status,
        toStatus: data.status,
        body: data.note ?? '',
        internal: false,
        authorId: p.userId,
      });
    if (data.priority && data.priority !== issue.priority)
      updates.push({ kind: 'priority', body: data.priority, internal: true, authorId: p.userId });
    if (data.assigneeId !== undefined && data.assigneeId !== issue.assigneeId)
      updates.push({
        kind: 'assigned',
        body: data.assigneeId ?? '',
        internal: true,
        authorId: p.userId,
      });
    if (!updates.length) return issue;
    const item = await this.prisma.issue.update({
      where: { id },
      data: {
        ...(data.status ? { status: data.status } : {}),
        ...(data.priority ? { priority: data.priority } : {}),
        ...(data.assigneeId !== undefined ? { assigneeId: data.assigneeId } : {}),
        updates: { create: updates },
      },
    });
    await this.log('updated', p.userId, id, { status: item.status, priority: item.priority });
    if (data.status && data.status !== issue.status)
      await this.notifications.notify(
        [issue.reporterId],
        'issue_status',
        `/issues/${issue.number}`,
        p.userId,
        `issue:${id}:${issue.status}->${data.status}:${item.updatedAt.toISOString()}`,
      );
    return item;
  }

  /** Internal notes need `issues.manage`; a public answer additionally needs `issues.respond`. */
  @Post('admin/issues/:id/comments')
  @HttpCode(201)
  @RequirePermission('issues.manage')
  async comment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    const data = parse(commentBody, body);
    if (data.public && !p.permissions.has('issues.respond'))
      throw new ForbiddenException({ code: 'FORBIDDEN' });
    const found = await this.prisma.issue.count({ where: { id } });
    if (!found) throw new NotFoundException({ code: 'NOT_FOUND' });
    const item = await this.prisma.issueUpdate.create({
      data: {
        issueId: id,
        authorId: p.userId,
        kind: data.public ? 'official' : 'comment',
        body: data.body,
        internal: !data.public,
      },
    });
    await this.prisma.issue.update({ where: { id }, data: { updatedAt: new Date() } });
    await this.log(data.public ? 'answered' : 'commented', p.userId, id);
    return item;
  }

  private log(
    action: string,
    actorId: string,
    id: string,
    metadata: Record<string, string | number | boolean> = {},
  ) {
    return this.audit.record({
      action: `issue.${action}`,
      outcome: 'success',
      actorId,
      entityType: 'issue',
      entityId: id,
      metadata,
    });
  }
}
