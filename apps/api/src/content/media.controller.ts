import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuditService } from '../audit/audit.service.js';
import {
  Authenticated,
  CurrentPrincipal,
  OptionalAuth,
  OptionalPrincipal,
} from '../auth/guards.js';
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

  /**
   * Raw image upload (body = image bytes, Content-Type = image/jpeg|png|webp), max 5 MB.
   * `?scope=private` marks a message attachment that is served only to conversation members.
   */
  @Post()
  @Authenticated()
  async upload(
    @Req() req: FastifyRequest,
    @Query('scope') scope: string | undefined,
    @CurrentPrincipal() principal: Principal,
  ) {
    const isPrivate = scope === 'private';
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
      data: { ownerId: principal.userId, storageKey, mime, size: body.length, private: isPrivate },
      select: { id: true, mime: true, size: true, private: true },
    });
    await this.audit.record({
      action: 'media.uploaded',
      outcome: 'success',
      actorId: principal.userId,
      entityType: 'media',
      entityId: asset.id,
      metadata: { mime, size: body.length, private: isPrivate },
    });
    return { ...asset, url: `/api/media/${asset.id}` };
  }

  @Get(':id')
  @OptionalAuth()
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() reply: FastifyReply,
    @OptionalPrincipal() p?: Principal,
  ) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset || (asset.private && !(await this.canSeePrivate(id, asset.ownerId, p))))
      throw new NotFoundException({ code: 'NOT_FOUND' });
    const data = await this.storage.get(asset.storageKey).catch(() => null);
    if (!data) throw new NotFoundException({ code: 'NOT_FOUND' });
    return reply
      .header('content-type', asset.mime)
      .header(
        'cache-control',
        asset.private ? 'private, no-store' : 'public, max-age=31536000, immutable',
      )
      .header('content-security-policy', "default-src 'none'")
      .header('x-content-type-options', 'nosniff')
      .send(data);
  }

  private async canSeePrivate(id: string, ownerId: string | null, p?: Principal) {
    if (!p) return false;
    if (ownerId === p.userId) return true;
    const shared = await this.prisma.message.count({
      where: {
        status: 'sent',
        mediaIds: { has: id },
        conversation: { members: { some: { userId: p.userId } } },
      },
    });
    return shared > 0;
  }
}
