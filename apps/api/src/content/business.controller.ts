import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { Authenticated, CurrentPrincipal, RequirePermission } from '../auth/guards.js';
import type { Principal } from '../auth/principal.js';
import { parse } from '../common/validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.controller.js';
import { uniqueSlug } from './slug.js';

const optText = (max: number) => z.string().trim().max(max).nullable().optional();
const cardBody = z.object({
  kind: z.enum(['organization', 'service']),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(20).max(5000),
  services: z.string().trim().max(3000).default(''),
  categoryId: z.uuid().nullable().optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{6,20}$/, 'Некорректный телефон')
    .nullable()
    .optional(),
  website: z
    .url({ protocol: /^https?$/ })
    .max(300)
    .nullable()
    .optional(),
  address: optText(200),
  serviceArea: optText(200),
  hours: optText(300),
});
type Card = z.infer<typeof cardBody>;
/** Changing these on a verified card drops the "verified" mark until staff re-check it. */
const VERIFIED_FIELDS: Array<keyof Card> = ['name', 'phone', 'website', 'address'];
const MAX_PENDING_APPLICATIONS = 3;
const MAX_NEW_INQUIRIES = 10;

const inquiryBody = z.object({
  message: z.string().trim().min(10).max(2000),
  contact: optText(200),
});
const replyBody = z.object({ reply: z.string().trim().min(2).max(2000) });
const reviewBody = z.object({ note: z.string().trim().max(1000).optional() });

const ownerSelect = {
  id: true,
  slug: true,
  kind: true,
  name: true,
  description: true,
  services: true,
  categoryId: true,
  phone: true,
  website: true,
  address: true,
  serviceArea: true,
  hours: true,
  status: true,
  verification: true,
  checkedAt: true,
  reviewNote: true,
  pendingChanges: true,
  submittedAt: true,
  updatedAt: true,
} as const;

/**
 * Business cabinet: owners apply for a listing and edit their own cards; every publication or change goes
 * through `business.review`. Residents can send inquiries to cards that have an owner account.
 */
@Controller()
export class BusinessController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private async checkCategory(card: Card) {
    if (!card.categoryId) return;
    const module = card.kind === 'service' ? 'services' : 'organizations';
    const ok = await this.prisma.category.count({
      where: { id: card.categoryId, module, active: true },
    });
    if (!ok)
      throw new BadRequestException({
        code: 'INVALID_CATEGORY',
        message: 'Выберите категорию раздела',
      });
  }

  private async own(id: string, userId: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id, ownerId: userId },
      select: ownerSelect,
    });
    if (!org) throw new NotFoundException({ code: 'NOT_FOUND' });
    return org;
  }

  @Get('business/organizations')
  @Authenticated()
  async mine(@CurrentPrincipal() p: Principal) {
    const orgs = await this.prisma.organization.findMany({
      where: { ownerId: p.userId },
      orderBy: { createdAt: 'desc' },
      select: { ...ownerSelect, _count: { select: { inquiries: { where: { status: 'new' } } } } },
    });
    return orgs.map(({ _count, ...o }) => ({ ...o, newInquiries: _count.inquiries }));
  }

  @Get('business/organizations/:id')
  @Authenticated()
  one(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: Principal) {
    return this.own(id, p.userId);
  }

  @Post('business/organizations')
  @Authenticated()
  async apply(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const data = parse(cardBody, body);
    await this.checkCategory(data);
    const pending = await this.prisma.organization.count({
      where: { ownerId: p.userId, status: { in: ['pending', 'needs_info'] } },
    });
    if (pending >= MAX_PENDING_APPLICATIONS)
      throw new BadRequestException({
        code: 'TOO_MANY_PENDING',
        message: 'Дождитесь рассмотрения уже поданных заявок',
      });
    const org = await this.prisma.organization.create({
      data: {
        ...data,
        slug: uniqueSlug(data.name),
        status: 'pending',
        ownerId: p.userId,
        createdById: p.userId,
        submittedAt: new Date(),
        sourceName: 'Заявка владельца',
      },
      select: { id: true, slug: true, status: true },
    });
    await this.log('business.application_submitted', p.userId, org.id);
    return org;
  }

  /** Not yet published: edited in place and re-queued. Published: stored as pending changes until review. */
  @Patch('business/organizations/:id')
  @Authenticated()
  async edit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    const data = parse(cardBody, body);
    const org = await this.own(id, p.userId);
    await this.checkCategory(data);
    if (org.status === 'archived' || org.status === 'draft')
      throw new BadRequestException({ code: 'NOT_EDITABLE', message: 'Карточка в архиве' });
    const now = new Date();
    const updated = await this.prisma.organization.update({
      where: { id },
      data:
        org.status === 'published'
          ? { pendingChanges: data as Prisma.InputJsonObject, submittedAt: now, reviewNote: null }
          : { ...data, status: 'pending', submittedAt: now, reviewNote: null },
      select: { id: true, status: true, pendingChanges: true },
    });
    await this.log('business.changes_submitted', p.userId, id, {
      published: org.status === 'published',
    });
    return { ...updated, pendingChanges: updated.pendingChanges !== null };
  }

  @Get('business/organizations/:id/inquiries')
  @Authenticated()
  async inquiries(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: Principal) {
    await this.own(id, p.userId);
    return this.prisma.businessInquiry.findMany({
      where: { organizationId: id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        message: true,
        contact: true,
        status: true,
        reply: true,
        repliedAt: true,
        createdAt: true,
      },
    });
  }

  @Post('business/inquiries/:id/reply')
  @HttpCode(200)
  @Authenticated()
  async reply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    const { reply } = parse(replyBody, body);
    const { count } = await this.prisma.businessInquiry.updateMany({
      where: { id, organization: { ownerId: p.userId } },
      data: { reply, status: 'answered', repliedAt: new Date() },
    });
    if (!count) throw new NotFoundException({ code: 'NOT_FOUND' });
    await this.log('business.inquiry_answered', p.userId, id);
    return { id, status: 'answered' };
  }

  @Post('organizations/:id/inquiries')
  @HttpCode(201)
  @Authenticated()
  async inquire(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    const data = parse(inquiryBody, body);
    const org = await this.prisma.organization.findFirst({
      where: { id, status: 'published', ownerId: { not: null } },
      select: { ownerId: true },
    });
    if (!org) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (org.ownerId === p.userId) throw new ForbiddenException({ code: 'OWN_ORGANIZATION' });
    const open = await this.prisma.businessInquiry.count({
      where: { senderId: p.userId, status: 'new' },
    });
    if (open >= MAX_NEW_INQUIRIES)
      throw new BadRequestException({
        code: 'TOO_MANY_INQUIRIES',
        message: 'Дождитесь ответов на уже отправленные заявки',
      });
    const item = await this.prisma.businessInquiry.create({
      data: { ...data, organizationId: id, senderId: p.userId },
      select: { id: true, status: true },
    });
    await this.log('business.inquiry_sent', p.userId, item.id, { organizationId: id });
    await this.notifications.notify(
      [org.ownerId!],
      'business_inquiry',
      '/business',
      p.userId,
      `inquiry:${item.id}`,
    );
    return item;
  }

  @Get('me/inquiries')
  @Authenticated()
  sent(@CurrentPrincipal() p: Principal) {
    return this.prisma.businessInquiry.findMany({
      where: { senderId: p.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        message: true,
        status: true,
        reply: true,
        repliedAt: true,
        createdAt: true,
        organization: { select: { name: true, slug: true, status: true } },
      },
    });
  }

  // ---- staff review queue
  @Get('admin/business/applications')
  @RequirePermission('business.review')
  async queue() {
    const items = await this.prisma.organization.findMany({
      where: {
        ownerId: { not: null },
        OR: [{ status: 'pending' }, { pendingChanges: { not: Prisma.AnyNull } }],
      },
      orderBy: { submittedAt: 'asc' },
      take: 100,
      select: { ...ownerSelect, ownerId: true },
    });
    const owners = await this.prisma.user.findMany({
      where: { id: { in: items.map((i) => i.ownerId!) } },
      select: { id: true, name: true, email: true },
    });
    const byId = new Map(owners.map((o) => [o.id, o]));
    return items.map(({ ownerId, ...i }) => ({
      ...i,
      type: i.status === 'pending' ? 'application' : 'changes',
      owner: byId.get(ownerId!) ?? null,
    }));
  }

  @Post('admin/business/applications/:id/:decision')
  @HttpCode(200)
  @RequirePermission('business.review')
  async review(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('decision') decision: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    if (!['approve', 'reject', 'request_info'].includes(decision))
      throw new NotFoundException({ code: 'NOT_FOUND' });
    const { note } = parse(reviewBody, body ?? {});
    if (decision !== 'approve' && (note?.length ?? 0) < 3)
      throw new BadRequestException({
        code: 'NOTE_REQUIRED',
        message: 'Укажите причину для владельца',
      });
    const org = await this.prisma.organization.findFirst({ where: { id, ownerId: { not: null } } });
    if (!org) throw new NotFoundException({ code: 'NOT_FOUND' });
    let data: Prisma.OrganizationUncheckedUpdateInput;
    if (org.status === 'pending') {
      data =
        decision === 'approve'
          ? { status: 'published', reviewNote: null }
          : { status: decision === 'reject' ? 'rejected' : 'needs_info', reviewNote: note };
    } else if (org.pendingChanges !== null) {
      const changes = parse(cardBody, org.pendingChanges);
      const touchesVerified = VERIFIED_FIELDS.some(
        (f) => (changes[f] ?? null) !== (org[f] ?? null),
      );
      data =
        decision === 'approve'
          ? {
              ...changes,
              categoryId: changes.categoryId ?? null,
              pendingChanges: Prisma.DbNull,
              reviewNote: null,
              ...(touchesVerified && org.verification === 'verified'
                ? { verification: 'unverified', checkedAt: null }
                : {}),
            }
          : { pendingChanges: Prisma.DbNull, reviewNote: note };
    } else throw new NotFoundException({ code: 'NOT_FOUND' });
    const updated = await this.prisma.organization.update({
      where: { id },
      data,
      select: { id: true, status: true, verification: true },
    });
    await this.log(
      `business.${org.status === 'pending' ? 'application' : 'changes'}_${decision}`,
      p.userId,
      id,
      note ? { note } : {},
    );
    await this.notifications.notify([org.ownerId!], 'business_reviewed', '/business', p.userId);
    return updated;
  }

  private log(
    action: string,
    actorId: string,
    id: string,
    metadata: Record<string, string | boolean> = {},
  ) {
    return this.audit.record({
      action,
      outcome: 'success',
      actorId,
      entityType: 'organization',
      entityId: id,
      metadata,
    });
  }
}
