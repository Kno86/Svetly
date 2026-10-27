import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  NotFoundException,
  SetMetadata,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FeatureKey } from './features.js';
import { FeaturesService } from './features.service.js';

const FEATURE_KEY = 'svetly:feature';

/** Rejects requests to a module whose feature flag is off; runs before session checks. */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly features: FeaturesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const key = this.reflector.getAllAndOverride<FeatureKey | undefined>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!key || (await this.features.isEnabled(key))) return true;
    throw new NotFoundException({ code: 'FEATURE_DISABLED', message: 'Раздел отключён' });
  }
}

export const Feature = (key: FeatureKey) =>
  applyDecorators(SetMetadata(FEATURE_KEY, key), UseGuards(FeatureGuard));
