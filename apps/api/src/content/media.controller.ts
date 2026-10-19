import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuditService } from '../audit/audit.service.js';
import { Authenticated, CurrentPrincipal } from '../auth/guards.js';
import type { Principal } from '../auth/principal.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  IMAGE_TYPES,
  LocalFileStorage,
  MAX_IMAGE_BYTES,
  type FileStorage,
} from './storage.service.js';

@Controller('media')
export class MediaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(LocalFileStorage) private readonly storage: FileStorage,
  ) {}

  /** Raw image upload (body = image bytes, Content-Type = image/jpeg|png|webp), max 5 MB. */
  @Post()
  @Authenticated()
  async upload(@Req() req: FastifyRequest, @CurrentPrincipal() principal: Principal) {
    const mime = (req.headers['content-type'] ?? '').split(';')[0]!.trim();
    const type = IMAGE_TYPES[mime];
    const body = req.body;
    if (!type || !Buffer.isBuffer(body)) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_MEDIA',
        message: 'Допустимы только JPEG, PNG и WebP',
      });
    }
    if (body.length === 0 || body.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException({
        code: 'MEDIA_TOO_LARGE',
        message: 'Размер изображения — до 5 МБ',
      });
    }
    if (!type.magic(body)) {
      throw new BadRequestException({
        code: 'MEDIA_TYPE_MISMATCH',
        message: 'Содержимое файла не соответствует типу',
      });
    }
    const storageKey = await this.storage.put(body, type.ext);
    const asset = await this.prisma.mediaAsset.create({
      data: { ownerId: principal.userId, storageKey, mime, size: body.length },
      select: { id: true, mime: true, size: true },
    });
    await this.audit.record({
      action: 'media.uploaded',
      outcome: 'success',
      actorId: principal.userId,
      entityType: 'media',
      entityId: asset.id,
      metadata: { mime, size: body.length },
    });
    return { ...asset, url: `/api/media/${asset.id}` };
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string, @Res() reply: FastifyReply) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException({ code: 'NOT_FOUND' });
    const data = await this.storage.get(asset.storageKey).catch(() => null);
    if (!data) throw new NotFoundException({ code: 'NOT_FOUND' });
    return reply
      .header('content-type', asset.mime)
      .header('cache-control', 'public, max-age=31536000, immutable')
      .header('content-security-policy', "default-src 'none'")
      .header('x-content-type-options', 'nosniff')
      .send(data);
  }
}
