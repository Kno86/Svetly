import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { CurrentPrincipal, RequirePermission } from '../auth/guards.js';
import type { Principal } from '../auth/principal.js';
import { parse } from '../common/validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LocalFileStorage, type FileStorage } from './storage.service.js';

/** Every column that references `media_assets`; a referenced asset cannot be deleted. */
const USAGE_SQL = `
SELECT id, count(*)::int AS n FROM (
  SELECT avatar_id AS id FROM users WHERE avatar_id IS NOT NULL
  UNION ALL SELECT cover_id FROM news_articles WHERE cover_id IS NOT NULL
  ${[
    'announcements',
    'organizations',
    'events',
    'directory_entries',
    'jobs',
    'lost_found',
    'issues',
    'polls',
    'groups',
    'posts',
  ]
    .map((t) => `UNION ALL SELECT unnest(image_ids) FROM ${t}`)
    .join('\n  ')}
  UNION ALL SELECT unnest(media_ids) FROM messages
) u GROUP BY id`;

const PAGE = 48;
const altBody = z.object({ alt: z.string().trim().max(300) });

@Controller('staff/media')
export class StaffMediaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(LocalFileStorage) private readonly storage: FileStorage,
  ) {}

  private async usage() {
    const rows = await this.prisma.$queryRawUnsafe<{ id: string; n: number }[]>(USAGE_SQL);
    return new Map(rows.map((r) => [r.id, r.n]));
  }

  /** Public images only: private message attachments never appear in the library. */
  @Get()
  @RequirePermission('media.manage')
  async list(
    @Query('q') q?: string,
    @Query('unused') unused?: string,
    @Query('page') pageParam?: string,
  ) {
    const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);
    const used = await this.usage();
    const term = q?.trim().slice(0, 100);
    const assets = await this.prisma.mediaAsset.findMany({
      where: { private: false, ...(term ? { alt: { contains: term, mode: 'insensitive' } } : {}) },
      orderBy: { createdAt: 'desc' },
      select: { id: true, ownerId: true, mime: true, size: true, alt: true, createdAt: true },
      take: 5000,
    });
    const filtered = unused === '1' ? assets.filter((a) => !used.has(a.id)) : assets;
    const slice = filtered.slice((page - 1) * PAGE, page * PAGE);
    const owners = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(slice.flatMap((a) => (a.ownerId ? [a.ownerId] : [])))] } },
      select: { id: true, name: true },
    });
    const names = new Map(owners.map((o) => [o.id, o.name]));
    return {
      total: filtered.length,
      page,
      pageSize: PAGE,
      items: slice.map((a) => ({
        ...a,
        ownerName: a.ownerId ? (names.get(a.ownerId) ?? null) : null,
        usage: used.get(a.id) ?? 0,
        url: `/api/media/${a.id}`,
      })),
    };
  }

  @Patch(':id')
  @RequirePermission('media.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    const { alt } = parse(altBody, body);
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset || asset.private) throw new NotFoundException({ code: 'NOT_FOUND' });
    await this.prisma.mediaAsset.update({ where: { id }, data: { alt } });
    await this.audit.record({
      action: 'media.updated',
      outcome: 'success',
      actorId: p.userId,
      entityType: 'media',
      entityId: id,
      metadata: {},
    });
    return { id, alt };
  }

  @Delete(':id')
  @RequirePermission('media.manage')
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: Principal) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset || asset.private) throw new NotFoundException({ code: 'NOT_FOUND' });
    const n = (await this.usage()).get(id) ?? 0;
    if (n > 0)
      throw new ConflictException({
        code: 'MEDIA_IN_USE',
        message: `Фото используется (${n}) — сначала уберите его из записей`,
      });
    await this.prisma.mediaAsset.delete({ where: { id } });
    await this.storage.remove(asset.storageKey).catch(() => undefined);
    await this.audit.record({
      action: 'media.deleted',
      outcome: 'success',
      actorId: p.userId,
      entityType: 'media',
      entityId: id,
      metadata: { size: asset.size },
    });
    return { ok: true };
  }
}
