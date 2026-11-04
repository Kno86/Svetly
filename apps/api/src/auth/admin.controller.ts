import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { canManageRole, isRoleCode, ROLES } from '../rbac/permissions.js';
import { CurrentPrincipal, RequirePermission } from './guards.js';
import type { Principal } from './principal.js';

const listQuery = z.object({
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const auditQuery = z.object({
  action: z.string().max(100).optional(),
  q: z.string().trim().max(100).optional(),
  actorId: z.uuid().optional(),
  entityType: z.string().max(50).optional(),
  entityId: z.string().max(100).optional(),
  outcome: z.enum(['success', 'denied', 'failure']).optional(),
  after: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: z.iso.datetime().optional(),
});
const roleBody = z.object({ role: z.string() });

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException({ code: 'VALIDATION_FAILED', issues: result.error.issues });
  }
  return result.data;
}

/** Staff API (no UI yet — the admin platform is a later phase). Every route is permission-checked on the server. */
@Controller('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('roles')
  @RequirePermission('roles.read')
  roles() {
    return this.prisma.role.findMany({
      orderBy: { rank: 'asc' },
      select: {
        code: true,
        name: true,
        description: true,
        rank: true,
        permissions: { select: { permissionCode: true } },
      },
    });
  }

  @Get('users')
  @RequirePermission('users.read')
  async users(@Query() query: unknown) {
    const { q, limit } = parse(listQuery, query);
    return this.prisma.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        blockedAt: true,
        avatarId: true,
        createdAt: true,
        roles: { select: { roleCode: true } },
      },
    });
  }

  @Post('users/:id/roles')
  @HttpCode(204)
  @RequirePermission('roles.assign')
  async grantRole(
    @CurrentPrincipal() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const { role } = parse(roleBody, body);
    await this.assertCanManage(actor, id, role, 'rbac.role_granted');
    await this.prisma.userRole.upsert({
      where: { userId_roleCode: { userId: id, roleCode: role } },
      create: { userId: id, roleCode: role, grantedById: actor.userId },
      update: {},
    });
    await this.audit.record({
      action: 'rbac.role_granted',
      outcome: 'success',
      actorId: actor.userId,
      entityType: 'user',
      entityId: id,
      metadata: { role },
    });
  }

  @Delete('users/:id/roles/:role')
  @HttpCode(204)
  @RequirePermission('roles.assign')
  async revokeRole(
    @CurrentPrincipal() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('role') role: string,
  ) {
    await this.assertCanManage(actor, id, role, 'rbac.role_revoked');
    await this.prisma.userRole.deleteMany({ where: { userId: id, roleCode: role } });
    await this.audit.record({
      action: 'rbac.role_revoked',
      outcome: 'success',
      actorId: actor.userId,
      entityType: 'user',
      entityId: id,
      metadata: { role },
    });
  }

  @Post('users/:id/block')
  @HttpCode(204)
  @RequirePermission('users.block')
  async block(@CurrentPrincipal() actor: Principal, @Param('id', ParseUUIDPipe) id: string) {
    await this.assertCanActOn(actor, id, 'users.blocked');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { blockedAt: new Date() } }),
      this.prisma.session.deleteMany({ where: { userId: id } }),
    ]);
    await this.audit.record({
      action: 'users.blocked',
      outcome: 'success',
      actorId: actor.userId,
      entityType: 'user',
      entityId: id,
    });
  }

  @Post('users/:id/unblock')
  @HttpCode(204)
  @RequirePermission('users.block')
  async unblock(@CurrentPrincipal() actor: Principal, @Param('id', ParseUUIDPipe) id: string) {
    await this.assertCanActOn(actor, id, 'users.unblocked');
    await this.prisma.user.update({ where: { id }, data: { blockedAt: null } });
    await this.audit.record({
      action: 'users.unblocked',
      outcome: 'success',
      actorId: actor.userId,
      entityType: 'user',
      entityId: id,
    });
  }

  @Post('users/:id/sessions/revoke')
  @HttpCode(204)
  @RequirePermission('users.sessions.revoke')
  async revokeSessions(
    @CurrentPrincipal() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.assertCanActOn(actor, id, 'users.sessions_revoked');
    const { count } = await this.prisma.session.deleteMany({ where: { userId: id } });
    await this.audit.record({
      action: 'users.sessions_revoked',
      outcome: 'success',
      actorId: actor.userId,
      entityType: 'user',
      entityId: id,
      metadata: { count },
    });
  }

  @Get('audit-log')
  @RequirePermission('audit.read')
  async auditLog(@Query() query: unknown) {
    const { action, q, actorId, entityType, entityId, outcome, limit, before, after } = parse(
      auditQuery,
      query,
    );
    return this.prisma.auditLog.findMany({
      where: {
        action: action ?? (q ? { contains: q, mode: 'insensitive' } : undefined),
        actorId,
        entityType,
        entityId,
        outcome,
        ...(before || after
          ? {
              occurredAt: {
                ...(before ? { lt: new Date(before) } : {}),
                ...(after ? { gte: new Date(after) } : {}),
              },
            }
          : {}),
      },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });
  }

  /** Staff can only act on users whose highest role is strictly below their own (and never on themselves). */
  private async assertCanActOn(
    actor: Principal,
    targetId: string,
    action: string,
  ): Promise<string[]> {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { roles: { select: { roleCode: true } } },
    });
    if (!target) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    const targetRoles = target.roles.map((r) => r.roleCode);
    const allowed =
      actor.userId !== targetId &&
      targetRoles.every((r) => !isRoleCode(r) || canManageRole(actor.roles, r));
    if (!allowed) await this.deny(actor, targetId, action, 'TARGET_PRIVILEGED');
    return targetRoles;
  }

  private async assertCanManage(
    actor: Principal,
    targetId: string,
    role: string,
    action: string,
  ): Promise<void> {
    if (!isRoleCode(role))
      throw new BadRequestException({ code: 'UNKNOWN_ROLE', allowed: Object.keys(ROLES) });
    await this.assertCanActOn(actor, targetId, action);
    if (!canManageRole(actor.roles, role))
      await this.deny(actor, targetId, action, 'ROLE_ABOVE_ACTOR', { role });
  }

  private async deny(
    actor: Principal,
    targetId: string,
    action: string,
    code: string,
    metadata: Record<string, string> = {},
  ): Promise<never> {
    await this.audit.record({
      action,
      outcome: 'denied',
      actorId: actor.userId,
      entityType: 'user',
      entityId: targetId,
      metadata: { code, ...metadata },
    });
    throw new ForbiddenException({ code, message: 'Недостаточно прав для этого действия' });
  }
}
