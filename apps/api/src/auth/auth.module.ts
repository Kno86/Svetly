import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AuthService } from './auth.service.js';
import { OptionalSessionGuard, PermissionGuard, SessionGuard } from './guards.js';
import { MailerService } from './mailer.service.js';
import { MeController } from './me.controller.js';

@Module({
  providers: [AuthService, MailerService, SessionGuard, OptionalSessionGuard, PermissionGuard],
  controllers: [MeController, AdminController],
  exports: [AuthService, SessionGuard, OptionalSessionGuard, PermissionGuard],
})
export class AuthModule {}
