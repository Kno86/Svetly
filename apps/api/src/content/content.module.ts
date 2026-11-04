import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AccountController } from './account.controller.js';
import { AdminPlatformController } from './admin-platform.controller.js';
import { AnnouncementsController } from './announcements.controller.js';
import { BusinessController } from './business.controller.js';
import { JobsController, LostFoundController } from './community.controller.js';
import { IssuesController } from './issues.controller.js';
import { PollsController } from './polls.controller.js';
import { AvatarController } from './avatar.controller.js';
import { ProfileController } from './profile.controller.js';
import { ReviewsController } from './reviews.controller.js';
import { FavoritesController } from './favorites.controller.js';
import { SocialController } from './social.controller.js';
import { MediaController } from './media.controller.js';
import { ModerationController } from './moderation.controller.js';
import { MessagesController } from './messages.controller.js';
import { RecommendationsController } from './recommendations.controller.js';
import { NotificationsController, NotificationsService } from './notifications.controller.js';
import { PublicContentController } from './public.controller.js';
import { EventRegistrationController, StaffContentController } from './staff.controller.js';
import { LocalFileStorage } from './storage.service.js';

@Module({
  imports: [AuthModule],
  controllers: [
    AccountController,
    PublicContentController,
    AnnouncementsController,
    StaffContentController,
    EventRegistrationController,
    MediaController,
    AdminPlatformController,
    BusinessController,
    JobsController,
    LostFoundController,
    IssuesController,
    PollsController,
    SocialController,
    FavoritesController,
    MessagesController,
    NotificationsController,
    RecommendationsController,
    ModerationController,
    ProfileController,
    AvatarController,
    ReviewsController,
  ],
  providers: [LocalFileStorage, NotificationsService],
})
export class ContentModule {}
