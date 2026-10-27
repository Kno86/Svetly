import { Module } from '@nestjs/common';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ContentModule } from './content/content.module.js';
import { ConfigModule } from './config/config.module.js';
import { HealthModule } from './health/health.module.js';
import { InstanceModule } from './instance/instance.module.js';
import { IntegrationsModule } from './integrations/integrations.module.js';
import { TerritoriesModule } from './territories/territories.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { VersionController } from './version/version.controller.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuditModule,
    AnalyticsModule,
    InstanceModule,
    HealthModule,
    AuthModule,
    IntegrationsModule,
    TerritoriesModule,
    ContentModule,
  ],
  controllers: [VersionController],
})
export class AppModule {}
