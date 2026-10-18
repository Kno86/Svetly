import { Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ConfigModule } from './config/config.module.js';
import { HealthModule } from './health/health.module.js';
import { InstanceModule } from './instance/instance.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { VersionController } from './version/version.controller.js';

@Module({
  imports: [ConfigModule, PrismaModule, AuditModule, InstanceModule, HealthModule, AuthModule],
  controllers: [VersionController],
})
export class AppModule {}
