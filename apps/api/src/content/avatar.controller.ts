import {
  Controller,
  Delete,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuditService } from '../audit/audit.service.js';
import { Authenticated, CurrentPrincipal, RequirePermission } from '../auth/guards.js';
import type { Principal } from '../auth/principal.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LocalFileStorage, readImage, type FileStorage } from './storage.service.js';

/**
 * Profile photo, uploaded as raw image bytes like `POST /api/media`. It is shown wherever the user's
 * name is shown. Each photo gets its own asset, so replaced and removed photos are deleted.
 */
@Controller()
export class AvatarController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(LocalFileStorage) private readonly storage: FileStorage,
  ) {}

  @Put('me/avatar')
  @Authenticated()
  async set(@CurrentPrincipal() p: Principal, @Req() req: FastifyRequest) {
    const { body, mime, ext } = readImage(req);
    const storageKey = await this.storage.put(body, ext);
    const { id: mediaId } = await this.prisma.mediaAsset.create({
      data: { ownerId: p.userId, storageKey, mime, size: body.length, alt: 'Фото профиля' },
      select: { id: true },
    });
    const previous = await this.swap(p.userId, mediaId);
    await this.audit.record({
      action: 'profile.avatar_updated',
      outcome: 'success',
      actorId: p.userId,
      entityType: 'user',
      entityId: p.userId,
    });
    await this.discard(previous, mediaId);
    return { avatarId: mediaId };
  }

  @Delete('me/avatar')
  @HttpCode(204)
  @Authenticated()
  async remove(@CurrentPrincipal() p: Principal) {
    const previous = await this.swap(p.userId, null);
    await this.audit.record({
      action: 'profile.avatar_removed',
      outcome: 'success',
      actorId: p.userId,
      entityType: 'user',
      entityId: p.userId,
    });
    await this.discard(previous, null);
  }

  /** Staff removal of an inappropriate photo. */
  @Delete('admin/users/:id/avatar')
  @HttpCode(204)
  @RequirePermission('users.block')
  async removeByStaff(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: Principal) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { avatarId: true } });
    if (!user?.avatarId) throw new NotFoundException({ code: 'NOT_FOUND' });
    const previous = await this.swap(id, null);
    await this.audit.record({
      action: 'users.avatar_removed',
      outcome: 'success',
      actorId: p.userId,
      entityType: 'user',
      entityId: id,
    });
    await this.discard(previous, null);
  }

  private async swap(userId: string, avatarId: string | null) {
    const before = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { avatarId: true },
    });
    await this.prisma.user.update({ where: { id: userId }, data: { avatarId } });
    return before.avatarId;
  }

  private async discard(previous: string | null, current: string | null) {
    if (!previous || previous === current) return;
    const asset = await this.prisma.mediaAsset
      .delete({ where: { id: previous }, select: { storageKey: true } })
      .catch(() => null);
    if (asset) await this.storage.remove(asset.storageKey);
  }
}
