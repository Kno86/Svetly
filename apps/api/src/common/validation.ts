import { BadRequestException } from '@nestjs/common';
import type { z } from 'zod';

export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException({ code: 'VALIDATION_FAILED', issues: result.error.issues });
  }
  return result.data;
}
