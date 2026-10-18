import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { HealthModule } from './health/health.module.js';
import { InstanceModule } from './instance/instance.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { VersionController } from './version/version.controller.js';

@Module({
  imports: [ConfigModule, PrismaModule, InstanceModule, HealthModule],
  controllers: [VersionController],
})
export class AppModule {}
