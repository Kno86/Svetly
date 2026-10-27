import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { Authenticated, CurrentPrincipal, RequirePermission } from '../auth/guards.js';
import type { Principal } from '../auth/principal.js';
import { parse } from '../common/validation.js';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { assertCoordinates, latitude, longitude } from './geo.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { uniqueSlug } from './slug.js';

const optText = (max: number) => z.string().trim().max(max).nullable().optional();
const url = z
  .url({ protocol: /^https?$/ })
  .max(500)
  .nullable()
  .optional();
const date = z.iso.datetime({ offset: true }).nullable().optional();

const newsBody = z.object({
  title: z.string().trim().min(3).max(200),
  excerpt: z.string().trim().max(500).default(''),
  body: z.string().trim().min(1).max(50_000),
  categoryId: z.uuid().nullable().optional(),
  coverId: z.uuid().nullable().optional(),
  pinned: z.boolean().default(false),
  sourceName: optText(200),
  sourceUrl: url,
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
});
const orgBody = z.object({
  kind: z.enum(['organization', 'service']).default('organization'),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().min(1).max(10_000),
  services: z.string().trim().max(5000).default(''),
  categoryId: z.uuid().nullable().optional(),
  phone: optText(40),
  website: url,
  address: optText(300),
  serviceArea: optText(300),
  latitude,
  longitude,
  hours: optText(300),
  hoursCheckedAt: date,
  sourceName: optText(200),
  sourceUrl: url,
  checkedAt: date,
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
});
const eventBody = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().min(1).max(20_000),
    organizer: z.string().trim().min(2).max(200),
    location: z.string().trim().min(2).max(300),
    latitude,
    longitude,
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: date,
    registrationUrl: url,
    capacity: z.number().int().min(1).max(100_000).nullable().optional(),
    categoryId: z.uuid().nullable().optional(),
    status: z.enum(['draft', 'published', 'cancelled', 'archived']).default('draft'),
  })
  .refine((e) => !e.endsAt || e.endsAt >= e.startsAt, {
    message: 'Окончание раньше начала',
    path: ['endsAt'],
  });
const directoryBody = z.object({
  title: z.string().trim().min(2).max(200),
  kind: z.enum(['contact', 'emergency', 'instruction', 'link', 'document']).default('contact'),
  body: z.string().trim().max(10_000).default(''),
  phone: optText(40),
  url,
  categoryId: z.uuid().nullable().optional(),
  sourceName: optText(200),
  sourceUrl: url,
  checkedAt: date,
  position: z.number().int().min(0).max(10_000).default(0),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
});

type Kind = 'news' | 'organization' | 'event' | 'directory';

/** Staff CRUD for editorial content. UI for it is the admin platform (next phase); every route is permission-checked. */
@Controller('staff')
export class StaffContentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async checkCategory(id: string | null | undefined, modules: string[]) {
    if (!id) return;
    const ok = await this.prisma.category.count({ where: { id, module: { in: modules } } });
    if (!ok) throw new BadRequestException({ code: 'INVALID_CATEGORY' });
  }

  private log(kind: Kind, action: string, actor: string, id: string, status?: string) {
    return this.audit.record({
      action: `content.${kind}_${action}`,
      outcome: 'success',
      actorId: actor,
      entityType: kind,
      entityId: id,
      metadata: status ? { status } : {},
    });
  }

  // ---- news
  @Get('news')
  @RequirePermission('content.news.manage')
  listNews() {
    return this.prisma.newsArticle.findMany({ orderBy: { updatedAt: 'desc' }, take: 200 });
  }

  @Post('news')
  @RequirePermission('content.news.manage')
  async createNews(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const data = parse(newsBody, body);
    await this.checkCategory(data.categoryId, ['news']);
    const item = await this.prisma.newsArticle.create({
      data: {
        ...data,
        slug: uniqueSlug(data.title),
        authorId: p.userId,
        updatedById: p.userId,
        publishedAt: data.status === 'published' ? new Date() : null,
      },
    });
    await this.log('news', 'created', p.userId, item.id, item.status);
    return item;
  }

  @Patch('news/:id')
  @RequirePermission('content.news.manage')
  async updateNews(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    const data = parse(newsBody, body);
    await this.checkCategory(data.categoryId, ['news']);
    const existing = await this.prisma.newsArticle.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND' });
    const item = await this.prisma.newsArticle.update({
      where: { id },
      data: {
        ...data,
        updatedById: p.userId,
        publishedAt:
          data.status === 'published' ? (existing.publishedAt ?? new Date()) : existing.publishedAt,
      },
    });
    await this.log('news', 'updated', p.userId, id, item.status);
    return item;
  }

  // ---- organizations & services
  @Get('organizations')
  @RequirePermission('content.organizations.manage')
  listOrganizations() {
    return this.prisma.organization.findMany({ orderBy: { updatedAt: 'desc' }, take: 200 });
  }

  @Post('organizations')
  @RequirePermission('content.organizations.manage')
  async createOrganization(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const data = parse(orgBody, body);
    assertCoordinates(data);
    await this.checkCategory(data.categoryId, ['organizations', 'services']);
    const item = await this.prisma.organization.create({
      data: { ...data, slug: uniqueSlug(data.name), createdById: p.userId },
    });
    await this.log('organization', 'created', p.userId, item.id, item.status);
    return item;
  }

  @Patch('organizations/:id')
  @RequirePermission('content.organizations.manage')
  async updateOrganization(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    const data = parse(orgBody, body);
    assertCoordinates(data);
    await this.checkCategory(data.categoryId, ['organizations', 'services']);
    const found = await this.prisma.organization.count({ where: { id } });
    if (!found) throw new NotFoundException({ code: 'NOT_FOUND' });
    const item = await this.prisma.organization.update({ where: { id }, data });
    await this.log('organization', 'updated', p.userId, id, item.status);
    return item;
  }

  // ---- events
  @Get('events')
  @RequirePermission('content.events.manage')
  listEvents() {
    return this.prisma.event.findMany({ orderBy: { startsAt: 'desc' }, take: 200 });
  }

  @Post('events')
  @RequirePermission('content.events.manage')
  async createEvent(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const data = parse(eventBody, body);
    assertCoordinates(data);
    await this.checkCategory(data.categoryId, ['events']);
    const item = await this.prisma.event.create({
      data: { ...data, slug: uniqueSlug(data.title), createdById: p.userId },
    });
    await this.log('event', 'created', p.userId, item.id, item.status);
    return item;
  }

  @Patch('events/:id')
  @RequirePermission('content.events.manage')
  async updateEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    const data = parse(eventBody, body);
    assertCoordinates(data);
    await this.checkCategory(data.categoryId, ['events']);
    const found = await this.prisma.event.count({ where: { id } });
    if (!found) throw new NotFoundException({ code: 'NOT_FOUND' });
    const item = await this.prisma.event.update({ where: { id }, data });
    await this.log('event', 'updated', p.userId, id, item.status);
    return item;
  }

  // ---- directory
  @Get('directory')
  @RequirePermission('content.directory.manage')
  listDirectory() {
    return this.prisma.directoryEntry.findMany({
      orderBy: [{ position: 'asc' }, { title: 'asc' }],
      take: 500,
    });
  }

  @Post('directory')
  @RequirePermission('content.directory.manage')
  async createDirectory(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const data = parse(directoryBody, body);
    await this.checkCategory(data.categoryId, ['directory']);
    const item = await this.prisma.directoryEntry.create({
      data: { ...data, slug: uniqueSlug(data.title) },
    });
    await this.log('directory', 'created', p.userId, item.id, item.status);
    return item;
  }

  @Patch('directory/:id')
  @RequirePermission('content.directory.manage')
  async updateDirectory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    const data = parse(directoryBody, body);
    await this.checkCategory(data.categoryId, ['directory']);
    const found = await this.prisma.directoryEntry.count({ where: { id } });
    if (!found) throw new NotFoundException({ code: 'NOT_FOUND' });
    const item = await this.prisma.directoryEntry.update({ where: { id }, data });
    await this.log('directory', 'updated', p.userId, id, item.status);
    return item;
  }
}

/** Resident registration for events: capacity is enforced inside a serializable transaction. */
@Controller('events')
export class EventRegistrationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  @Get(':id/registration')
  @Authenticated()
  async status(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: Principal) {
    const found = await this.prisma.eventRegistration.count({
      where: { eventId: id, userId: p.userId },
    });
    return { registered: found > 0 };
  }

  @Post(':id/registration')
  @HttpCode(204)
  @Authenticated()
  async register(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: Principal) {
    const created = await this.prisma.$transaction(
      async (tx) => {
        const event = await tx.event.findFirst({ where: { id, status: 'published' } });
        if (!event) throw new NotFoundException({ code: 'NOT_FOUND' });
        if (event.startsAt <= new Date()) {
          throw new BadRequestException({
            code: 'EVENT_STARTED',
            message: 'Регистрация закрыта: событие уже началось',
          });
        }
        const exists = await tx.eventRegistration.count({
          where: { eventId: id, userId: p.userId },
        });
        if (exists) return false;
        if (event.capacity !== null) {
          const taken = await tx.eventRegistration.count({ where: { eventId: id } });
          if (taken >= event.capacity)
            throw new BadRequestException({ code: 'EVENT_FULL', message: 'Мест больше нет' });
        }
        await tx.eventRegistration.create({ data: { eventId: id, userId: p.userId } });
        return true;
      },
      { isolationLevel: 'Serializable' },
    );
    if (created)
      await this.analytics.track('event_registration', {
        userId: p.userId,
        entityType: 'event',
        entityId: id,
      });
  }

  @Delete(':id/registration')
  @HttpCode(204)
  @Authenticated()
  async cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: Principal) {
    await this.prisma.eventRegistration.deleteMany({ where: { eventId: id, userId: p.userId } });
  }
}
