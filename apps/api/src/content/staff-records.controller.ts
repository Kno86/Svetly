import {
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { Authenticated, CurrentPrincipal } from '../auth/guards.js';
import type { Principal } from '../auth/principal.js';
import { parse } from '../common/validation.js';
import type { PermissionCode } from '../rbac/permissions.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ISSUE_STATUSES } from './issues.controller.js';
import { assertPublicImages } from './media-refs.js';

type Row = Record<string, unknown> & { id: string; updatedAt: Date };
interface Delegate {
  findMany(args: unknown): Promise<Row[]>;
  count(args: unknown): Promise<number>;
  findUnique(args: unknown): Promise<Row | null>;
  update(args: unknown): Promise<Row>;
  delete(args: unknown): Promise<unknown>;
}

interface RecordType {
  model: 'announcement' | 'job' | 'lostFoundItem' | 'group' | 'post' | 'poll' | 'issue';
  permission: PermissionCode;
  /** Title column; posts have none and are listed by the start of the text. */
  title?: string;
  text: string;
  author: string;
  statuses: readonly string[];
  href: (r: Row) => string;
}

/** Resident-created and community records that staff can browse, edit and delete in any status. */
const TYPES: Record<string, RecordType> = {
  announcements: {
    model: 'announcement',
    permission: 'moderation.announcements',
    title: 'title',
    text: 'description',
    author: 'authorId',
    statuses: ['pending', 'published', 'rejected', 'closed', 'archived'],
    href: (r) => `/announcements/${String(r.slug)}`,
  },
  jobs: {
    model: 'job',
    permission: 'moderation.community',
    title: 'title',
    text: 'description',
    author: 'authorId',
    statuses: ['pending', 'published', 'rejected', 'closed'],
    href: (r) => `/jobs/${String(r.slug)}`,
  },
  'lost-found': {
    model: 'lostFoundItem',
    permission: 'moderation.community',
    title: 'title',
    text: 'description',
    author: 'authorId',
    statuses: ['pending', 'published', 'rejected', 'resolved', 'closed'],
    href: (r) => `/lost-found/${String(r.slug)}`,
  },
  groups: {
    model: 'group',
    permission: 'moderation.community',
    title: 'name',
    text: 'description',
    author: 'createdById',
    statuses: ['pending', 'active', 'rejected', 'removed'],
    href: (r) => `/groups/${String(r.slug)}`,
  },
  posts: {
    model: 'post',
    permission: 'moderation.community',
    text: 'body',
    author: 'authorId',
    statuses: ['pending', 'published', 'rejected', 'removed'],
    href: (r) => `/feed/${r.id}`,
  },
  polls: {
    model: 'poll',
    permission: 'polls.manage',
    title: 'title',
    text: 'description',
    author: 'createdById',
    statuses: ['draft', 'published', 'archived'],
    href: (r) => `/polls/${String(r.slug)}`,
  },
  issues: {
    model: 'issue',
    permission: 'issues.manage',
    title: 'title',
    text: 'description',
    author: 'reporterId',
    statuses: ISSUE_STATUSES,
    href: (r) => `/issues/${String(r.number)}`,
  },
};

const PAGE = 50;
const patchBody = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  text: z.string().trim().min(1).max(20_000).optional(),
  status: z.string().max(40).optional(),
  imageIds: z.array(z.uuid()).max(10).optional(),
});

@Controller('staff/records')
export class StaffRecordsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private resolve(type: string, p: Principal) {
    const cfg = Object.hasOwn(TYPES, type) ? TYPES[type] : undefined;
    if (!cfg) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (!p.permissions.has(cfg.permission)) throw new ForbiddenException({ code: 'FORBIDDEN' });
    const db = (this.prisma as unknown as Record<string, Delegate>)[cfg.model]!;
    return { cfg, db };
  }

  private view(cfg: RecordType, r: Row, names: Map<string, string>) {
    const text = String(r[cfg.text] ?? '');
    const author = r[cfg.author] as string | null;
    return {
      id: r.id,
      title: cfg.title ? String(r[cfg.title] ?? '') : text.slice(0, 80),
      text,
      status: String(r.status),
      imageIds: (r.imageIds as string[] | undefined) ?? [],
      updatedAt: r.updatedAt,
      href: cfg.href(r),
      authorName: author ? (names.get(author) ?? null) : null,
    };
  }

  private async names(cfg: RecordType, rows: Row[]) {
    const ids = [...new Set(rows.map((r) => r[cfg.author]).filter((v): v is string => !!v))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    return new Map(users.map((u) => [u.id, u.name]));
  }

  @Get(':type')
  @Authenticated()
  async list(
    @Param('type') type: string,
    @CurrentPrincipal() p: Principal,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('page') pageParam?: string,
  ) {
    const { cfg, db } = this.resolve(type, p);
    const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);
    const term = q?.trim().slice(0, 100);
    const where = {
      ...(status && cfg.statuses.includes(status) ? { status } : {}),
      ...(term ? { [cfg.title ?? cfg.text]: { contains: term, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      db.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * PAGE, take: PAGE }),
      db.count({ where }),
    ]);
    const names = await this.names(cfg, rows);
    return {
      total,
      page,
      pageSize: PAGE,
      statuses: cfg.statuses,
      hasTitle: !!cfg.title,
      items: rows.map((r) => this.view(cfg, r, names)),
    };
  }

  @Patch(':type/:id')
  @Authenticated()
  async update(
    @Param('type') type: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    const { cfg, db } = this.resolve(type, p);
    const input = parse(patchBody, body);
    if (input.status && !cfg.statuses.includes(input.status))
      throw new ConflictException({ code: 'INVALID_STATUS', message: 'Недопустимый статус' });
    await assertPublicImages(this.prisma, input.imageIds);
    const existing = await db.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND' });
    const data: Record<string, unknown> = {};
    if (input.title !== undefined && cfg.title) data[cfg.title] = input.title;
    if (input.text !== undefined) data[cfg.text] = input.text;
    if (input.status !== undefined) data.status = input.status;
    if (input.imageIds !== undefined) data.imageIds = input.imageIds;
    const row = await db.update({ where: { id }, data });
    await this.audit.record({
      action: `staff.record_updated`,
      outcome: 'success',
      actorId: p.userId,
      entityType: cfg.model,
      entityId: id,
      metadata: { fields: Object.keys(data), status: String(row.status) },
    });
    return this.view(cfg, row, await this.names(cfg, [row]));
  }

  @Delete(':type/:id')
  @Authenticated()
  async remove(
    @Param('type') type: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPrincipal() p: Principal,
  ) {
    const { cfg, db } = this.resolve(type, p);
    try {
      await db.delete({ where: { id } });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'P2025') throw new NotFoundException({ code: 'NOT_FOUND' });
      if (code === 'P2003')
        throw new ConflictException({
          code: 'IN_USE',
          message: 'Запись связана с другими данными — смените статус вместо удаления',
        });
      throw e;
    }
    await this.audit.record({
      action: 'staff.record_deleted',
      outcome: 'success',
      actorId: p.userId,
      entityType: cfg.model,
      entityId: id,
      metadata: {},
    });
    return { ok: true };
  }
}
