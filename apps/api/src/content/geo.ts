import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

/** Bounding box of Novosibirsk oblast; coordinates outside it are rejected as data-entry errors. */
export const REGION_BOUNDS = { minLat: 53.2, maxLat: 57.3, minLng: 75.0, maxLng: 85.2 };

export const latitude = z
  .number()
  .min(REGION_BOUNDS.minLat)
  .max(REGION_BOUNDS.maxLat)
  .nullable()
  .optional();
export const longitude = z
  .number()
  .min(REGION_BOUNDS.minLng)
  .max(REGION_BOUNDS.maxLng)
  .nullable()
  .optional();

/** Coordinates come as a verified pair or not at all. */
export function assertCoordinates(data: { latitude?: number | null; longitude?: number | null }) {
  if ((data.latitude == null) !== (data.longitude == null))
    throw new BadRequestException({
      code: 'VALIDATION',
      message: 'Укажите обе координаты или ни одной',
      fields: { latitude: 'Нужна пара широта/долгота' },
    });
}
