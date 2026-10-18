import { randomUUID } from 'node:crypto';
import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export const INSTANCE_SETTING_KEY = 'instance';

export interface InstanceInfo {
  id: string;
  initializedAt: string;
}

/**
 * Identifies this installation. Created once on first start and never overwritten,
 * which also makes data persistence across restarts verifiable.
 */
@Injectable()
export class InstanceService implements OnApplicationBootstrap {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.ensureInstance();
  }

  async ensureInstance(): Promise<InstanceInfo> {
    const candidate: InstanceInfo = { id: randomUUID(), initializedAt: new Date().toISOString() };
    const setting = await this.prisma.setting.upsert({
      where: { key: INSTANCE_SETTING_KEY },
      create: { key: INSTANCE_SETTING_KEY, value: { ...candidate } },
      update: {},
    });
    return setting.value as unknown as InstanceInfo;
  }

  async getInstance(): Promise<InstanceInfo | null> {
    const setting = await this.prisma.setting.findUnique({ where: { key: INSTANCE_SETTING_KEY } });
    return setting ? (setting.value as unknown as InstanceInfo) : null;
  }
}
