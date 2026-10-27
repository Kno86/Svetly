import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TerritoriesController } from './territories.controller.js';

@Module({ imports: [AuthModule], controllers: [TerritoriesController] })
export class TerritoriesModule {}
