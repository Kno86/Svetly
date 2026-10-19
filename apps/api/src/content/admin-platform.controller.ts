import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { Authenticated, CurrentPrincipal, RequirePermission } from '../auth/guards.js';
import type { Principal } from '../auth/principal.js';
import { parse } from '../common/validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { trustedThreshold } from './announcements.controller.js';

const ENTITY_TYPES = ['announcement', 'organization', 'news', 'event'] as const;
type EntityType = (typeof ENTITY_TYPES)[number];
const MODULES = [
  'news',
  'announcements',
  'services',
  'organizations',
  'events',
  'directory',
] as const;
const MAX_OPEN_COMPLAINTS = 20;
/** Directory/organization data older than this is flagged on the dashboard for re-checking. */
const STALE_DAYS = 180;

const complaintBody = z.object({
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.uuid(),
  reason: z.enum(['spam', 'fraud', 'offensive', 'wrong_info', 'other']),
  details: z.string().trim().max(2000).default(''),
});
const complaintQuery = z.object({
  status: z.enum(['open', 'resolved', 'dismissed']).default('open'),
});
const resolveBody = z.object({
  decision: z.enum(['resolved', 'dismissed']),
  note: z.string().trim().min(3).max(1000),
});
const settingsBody = z.object({
  trustedThreshold: z.number().int().min(0).max(50),
});
const categoryBody = z.object({
  module: z.enum(MODULES),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(60),
  name: z.string().trim().min(2).max(80),
  position: z.number().int().min(0).max(10_000).default(0),
  active: z.boolean().default(true),
});
const categoryPatch = categoryBody.omit({ module: true }).partial();
const verificationBody = z.object({
  verification: z.enum(['unverified', 'verified']),
  sourceName: z.string().trim().max(200).nullable().optional(),
});

/** Admin platform API: complaints, settings, categories, organization verification and the staff dashboard. */
@Controller()
export class AdminPlatformController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---- complaints (any signed-in resident may report published content)
  @Post('complaints')
  @Authenticated()
  @HttpCode(201)
  async complain(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const data = parse(complaintBody, body);
    if (!(await this.isPublished(data.entityType, data.entityId)))
      throw new NotFoundException({ code: 'NOT_FOUND' });
    const existing = await this.prisma.complaint.findFirst({
      where: {
        reporterId: p.userId,
        entityType: data.entityType,
        entityId: data.entityId,
        status: 'open',
      },
      select: { id: true, status: true },
    });
    if (existing) return existing;
    const open = await this.prisma.complaint.count({
      where: { reporterId: p.userId, status: 'open' },
    });
    if (open >= MAX_OPEN_COMPLAINTS)
      throw new HttpException({ code: 'TOO_MANY_COMPLAINTS' }, HttpStatus.TOO_MANY_REQUESTS);
    const item = await this.prisma.complaint.create({
      data: { ...data, reporterId: p.userId },
      select: { id: true, status: true },
    });
    await this.audit.record({
      action: 'complaint.created',
      outcome: 'success',
      actorId: p.userId,
      entityType: data.entityType,
      entityId: data.entityId,
      metadata: { complaintId: item.id, reason: data.reason },
    });
    return item;
  }

  @Get('admin/complaints')
  @RequirePermission('complaints.manage')
  async complaints(@Query() query: unknown) {
    const { status } = parse(complaintQuery, query);
    const items = await this.prisma.complaint.findMany({
      where: { status },
      orderBy: { createdAt: status === 'open' ? 'asc' : 'desc' },
      take: 100,
    });
    const targets = await this.describeTargets(items);
    return items.map((c) => ({
      ...c,
      target: targets.get(`${c.entityType}:${c.entityId}`) ?? null,
    }));
  }

  @Post('admin/complaints/:id/resolve')
  @RequirePermission('complaints.manage')
  @HttpCode(200)
  async resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    const { decision, note } = parse(resolveBody, body);
    const { count } = await this.prisma.complaint.updateMany({
      where: { id, status: 'open' },
      data: {
        status: decision,
        resolutionNote: note,
        resolvedById: p.userId,
        resolvedAt: new Date(),
      },
    });
    if (!count) throw new NotFoundException({ code: 'NOT_FOUND' });
    await this.audit.record({
      action: `complaint.${decision}`,
      outcome: 'success',
      actorId: p.userId,
      entityType: 'complaint',
      entityId: id,
    });
    return { id, status: decision };
  }

  // ---- settings
  @Get('admin/settings')
  @RequirePermission('settings.manage')
  async settings() {
    return { trustedThreshold: await trustedThreshold(this.prisma) };
  }

  @Patch('admin/settings')
  @RequirePermission('settings.manage')
  async updateSettings(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const data = parse(settingsBody, body);
    const before = await trustedThreshold(this.prisma);
    await this.prisma.setting.upsert({
      where: { key: 'moderation.trustedThreshold' },
      create: { key: 'moderation.trustedThreshold', value: data.trustedThreshold },
      update: { value: data.trustedThreshold },
    });
    await this.audit.record({
      action: 'settings.updated',
      outcome: 'success',
      actorId: p.userId,
      entityType: 'setting',
      entityId: 'moderation.trustedThreshold',
      metadata: { key: 'moderation.trustedThreshold', from: before, to: data.trustedThreshold },
    });
    return data;
  }

  // ---- categories
  @Get('admin/categories')
  @RequirePermission('content.categories.manage')
  categories() {
    return this.prisma.category.findMany({ orderBy: [{ module: 'asc' }, { position: 'asc' }] });
  }

  @Post('admin/categories')
  @RequirePermission('content.categories.manage')
  async createCategory(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const data = parse(categoryBody, body);
    const taken = await this.prisma.category.count({
      where: { module: data.module, slug: data.slug },
    });
    if (taken) throw new ConflictException({ code: 'SLUG_TAKEN' });
    const item = await this.prisma.category.create({ data });
    await this.logCategory('created', p.userId, item.id);
    return item;
  }

  @Patch('admin/categories/:id')
  @RequirePermission('content.categories.manage')
  async updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    const data = parse(categoryPatch, body);
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (data.slug && data.slug !== existing.slug) {
      const taken = await this.prisma.category.count({
        where: { module: existing.module, slug: data.slug },
      });
      if (taken) throw new ConflictException({ code: 'SLUG_TAKEN' });
    }
    const item = await this.prisma.category.update({ where: { id }, data });
    await this.logCategory('updated', p.userId, id);
    return item;
  }

  // ---- organization verification
  @Post('admin/organizations/:id/verification')
  @RequirePermission('organizations.verify')
  @HttpCode(200)
  async verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    const data = parse(verificationBody, body);
    const found = await this.prisma.organization.count({ where: { id } });
    if (!found) throw new NotFoundException({ code: 'NOT_FOUND' });
    const item = await this.prisma.organization.update({
      where: { id },
      data: {
        verification: data.verification,
        ...(data.verification === 'verified'
          ? { checkedAt: new Date(), ...(data.sourceName ? { sourceName: data.sourceName } : {}) }
          : {}),
      },
      select: { id: true, verification: true, checkedAt: true },
    });
    await this.audit.record({
      action: `organization.${data.verification}`,
      outcome: 'success',
      actorId: p.userId,
      entityType: 'organization',
      entityId: id,
    });
    return item;
  }

  // ---- dashboard: counters limited to what the caller may manage
  @Get('admin/dashboard')
  @Authenticated()
  async dashboard(@CurrentPrincipal() p: Principal) {
    const can = (perm: Parameters<Principal['permissions']['has']>[0]) => p.permissions.has(perm);
    if (p.permissions.size === 0)
      throw new HttpException({ code: 'FORBIDDEN' }, HttpStatus.FORBIDDEN);
    const stale = new Date(Date.now() - STALE_DAYS * 86_400_000);
    const out: Record<string, number> = {};
    const jobs: Array<Promise<void>> = [];
    const add = (key: string, q: Promise<number>) => jobs.push(q.then((n) => void (out[key] = n)));
    if (can('moderation.announcements'))
      add('pendingAnnouncements', this.prisma.announcement.count({ where: { status: 'pending' } }));
    if (can('complaints.manage'))
      add('openComplaints', this.prisma.complaint.count({ where: { status: 'open' } }));
    if (can('content.news.manage'))
      add('draftNews', this.prisma.newsArticle.count({ where: { status: 'draft' } }));
    if (can('content.events.manage'))
      add(
        'upcomingEvents',
        this.prisma.event.count({ where: { status: 'published', startsAt: { gte: new Date() } } }),
      );
    if (can('content.organizations.manage')) {
      add(
        'unverifiedOrganizations',
        this.prisma.organization.count({
          where: { status: { not: 'archived' }, verification: 'unverified' },
        }),
      );
    }
    if (can('content.directory.manage'))
      add(
        'staleDirectory',
        this.prisma.directoryEntry.count({
          where: { status: 'published', OR: [{ checkedAt: null }, { checkedAt: { lt: stale } }] },
        }),
      );
    if (can('users.read')) add('users', this.prisma.user.count());
    await Promise.all(jobs);
    return { counters: out, permissions: [...p.permissions].sort() };
  }

  private logCategory(action: string, actor: string, id: string) {
    return this.audit.record({
      action: `category.${action}`,
      outcome: 'success',
      actorId: actor,
      entityType: 'category',
      entityId: id,
    });
  }

  private async isPublished(type: EntityType, id: string): Promise<boolean> {
    const where = { id, status: 'published' };
    switch (type) {
      case 'announcement':
        return (
          (await this.prisma.announcement.count({
            where: { ...where, expiresAt: { gt: new Date() } },
          })) > 0
        );
      case 'organization':
        return (await this.prisma.organization.count({ where })) > 0;
      case 'news':
        return (await this.prisma.newsArticle.count({ where })) > 0;
      case 'event':
        return (await this.prisma.event.count({ where })) > 0;
    }
  }

  private async describeTargets(items: Array<{ entityType: string; entityId: string }>) {
    const ids = (t: EntityType) => items.filter((i) => i.entityType === t).map((i) => i.entityId);
    const map = new Map<string, { title: string; slug: string; status: string }>();
    const put = (
      t: EntityType,
      rows: Array<{ id: string; slug: string; status: string; title?: string; name?: string }>,
    ) =>
      rows.forEach((r) =>
        map.set(`${t}:${r.id}`, { title: r.title ?? r.name ?? '', slug: r.slug, status: r.status }),
      );
    const sel = { id: true, slug: true, status: true } as const;
    put(
      'announcement',
      await this.prisma.announcement.findMany({
        where: { id: { in: ids('announcement') } },
        select: { ...sel, title: true },
      }),
    );
    put(
      'news',
      await this.prisma.newsArticle.findMany({
        where: { id: { in: ids('news') } },
        select: { ...sel, title: true },
      }),
    );
    put(
      'event',
      await this.prisma.event.findMany({
        where: { id: { in: ids('event') } },
        select: { ...sel, title: true },
      }),
    );
    put(
      'organization',
      await this.prisma.organization.findMany({
        where: { id: { in: ids('organization') } },
        select: { ...sel, name: true },
      }),
    );
    return map;
  }
}
