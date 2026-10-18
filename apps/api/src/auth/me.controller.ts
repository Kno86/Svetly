import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Authenticated, CurrentPrincipal } from './guards.js';
import type { Principal } from './principal.js';

@Controller('me')
@Authenticated()
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async me(@CurrentPrincipal() principal: Principal) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: principal.userId },
      select: { id: true, name: true, email: true, emailVerified: true, createdAt: true },
    });
    return { user, roles: principal.roles, permissions: [...principal.permissions].sort() };
  }
}
