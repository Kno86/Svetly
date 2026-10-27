import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { CurrentPrincipal, RequirePermission } from '../auth/guards.js';
import type { Principal } from '../auth/principal.js';
import { parse } from '../common/validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FEATURES, FEATURES_SETTING, isFeatureKey, providerStatuses } from './features.js';
import { FeaturesService } from './features.service.js';

const toggleBody = z.object({ enabled: z.boolean() });

@Controller()
export class IntegrationsController {
  constructor(
    private readonly features: FeaturesService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Public on/off map so the UI hides disabled modules; the API enforces the same flags. */
  @Get('features')
  async publicFeatures() {
    return Object.fromEntries((await this.features.resolve()).map((f) => [f.key, f.enabled]));
  }

  @Get('admin/integrations')
  @RequirePermission('settings.manage')
  async overview() {
    return {
      environment: this.features.config.environment,
      features: await this.features.resolve(),
      providers: providerStatuses(this.features.config),
    };
  }

  @Patch('admin/features/:key')
  @RequirePermission('settings.manage')
  async toggle(@Param('key') key: string, @Body() body: unknown, @CurrentPrincipal() p: Principal) {
    if (!isFeatureKey(key))
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Неизвестный флаг' });
    const { enabled } = parse(toggleBody, body);
    if (enabled && FEATURES[key].status !== 'available')
      throw new ConflictException({
        code: 'NOT_CONFIGURED',
        message: FEATURES[key].reason ?? 'Интеграция не настроена',
      });
    const overrides = await this.features.overrides();
    const from = (await this.features.resolve()).find((f) => f.key === key)!.enabled;
    const value = { ...overrides, [key]: enabled };
    await this.prisma.setting.upsert({
      where: { key: FEATURES_SETTING },
      create: { key: FEATURES_SETTING, value },
      update: { value },
    });
    await this.audit.record({
      action: 'feature.updated',
      outcome: 'success',
      actorId: p.userId,
      entityType: 'setting',
      entityId: FEATURES_SETTING,
      metadata: { key, from, to: enabled },
    });
    return this.overview();
  }

  /** No provider is connected: answer honestly instead of returning a fabricated reply. */
  @Post('assistant/ask')
  async ask() {
    if (!(await this.features.isEnabled('ai_assistant')))
      throw new ServiceUnavailableException({
        code: 'NOT_CONFIGURED',
        message: `AI-помощник не подключён. ${FEATURES.ai_assistant.reason}`,
      });
    throw new ServiceUnavailableException({
      code: 'NOT_CONFIGURED',
      message: 'Провайдер не задан',
    });
  }
}
