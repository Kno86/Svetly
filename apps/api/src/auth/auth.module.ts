import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AuthService } from './auth.service.js';
import { PermissionGuard, SessionGuard } from './guards.js';
import { MailerService } from './mailer.service.js';
import { MeController } from './me.controller.js';

@Module({
  providers: [AuthService, MailerService, SessionGuard, PermissionGuard],
  controllers: [MeController, AdminController],
  exports: [AuthService, SessionGuard, PermissionGuard],
})
export class AuthModule {}
