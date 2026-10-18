import { Module } from '@nestjs/common';
import { InstanceService } from './instance.service.js';

@Module({
  providers: [InstanceService],
  exports: [InstanceService],
})
export class InstanceModule {}
