import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminPlatformController } from './admin-platform.controller.js';
import { AnnouncementsController } from './announcements.controller.js';
import { MediaController } from './media.controller.js';
import { PublicContentController } from './public.controller.js';
import { EventRegistrationController, StaffContentController } from './staff.controller.js';
import { LocalFileStorage } from './storage.service.js';

@Module({
  imports: [AuthModule],
  controllers: [
    PublicContentController,
    AnnouncementsController,
    StaffContentController,
    EventRegistrationController,
    MediaController,
    AdminPlatformController,
  ],
  providers: [LocalFileStorage],
})
export class ContentModule {}
