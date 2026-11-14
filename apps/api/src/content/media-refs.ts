import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import type { PrismaService } from '../prisma/prisma.service.js';

export const imageIdsField = (max = 10) => z.array(z.uuid()).max(max).default([]);

/**
 * Checks that attached images exist and are public. With `ownerId` they must also belong to that user
 * (residents and business owners); staff may attach any public asset from the media library.
 */
export async function assertPublicImages(
  prisma: PrismaService,
  ids: readonly string[] | undefined,
  ownerId?: string,
) {
  if (!ids?.length) return;
  const unique = new Set(ids);
  const found = await prisma.mediaAsset.count({
    where: { id: { in: [...unique] }, private: false, ...(ownerId ? { ownerId } : {}) },
  });
  if (found !== unique.size)
    throw new BadRequestException({
      code: 'INVALID_MEDIA',
      message: ownerId
        ? 'Можно прикреплять только свои изображения'
        : 'Изображение не найдено в медиатеке',
    });
}
