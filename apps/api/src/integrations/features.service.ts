import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  FEATURES_SETTING,
  type FeatureKey,
  type ResolvedFeature,
  resolveFeatures,
} from './features.js';

@Injectable()
export class FeaturesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) readonly config: AppConfig,
  ) {}

  async overrides(): Promise<Record<string, boolean>> {
    const row = await this.prisma.setting.findUnique({ where: { key: FEATURES_SETTING } });
    return (row?.value ?? {}) as Record<string, boolean>;
  }

  async resolve(): Promise<ResolvedFeature[]> {
    return resolveFeatures(await this.overrides(), this.config.environment);
  }

  async isEnabled(key: FeatureKey): Promise<boolean> {
    return (await this.resolve()).find((f) => f.key === key)?.enabled ?? false;
  }
}
