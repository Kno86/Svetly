import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FeatureGuard } from './feature.guard.js';
import { FeaturesService } from './features.service.js';
import { IntegrationsController } from './integrations.controller.js';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [IntegrationsController],
  providers: [FeaturesService, FeatureGuard],
  exports: [FeaturesService, FeatureGuard],
})
export class IntegrationsModule {}
