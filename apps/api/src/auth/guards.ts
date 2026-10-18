import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  applyDecorators,
  createParamDecorator,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyRequest } from 'fastify';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { type PermissionCode, permissionsForRoles } from '../rbac/permissions.js';
import { AuthService, clientIp } from './auth.service.js';
import type { Principal } from './principal.js';

const PERMISSION_KEY = 'svetly:permission';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Resolves the session cookie into a principal; rejects anonymous, blocked and cross-site mutating requests. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    if (!SAFE_METHODS.has(req.method)) this.assertSameOrigin(req);

    const result = await this.authService.auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!result)
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Требуется вход' });

    const user = await this.prisma.user.findUnique({
      where: { id: result.user.id },
      select: { blockedAt: true, roles: { select: { roleCode: true } } },
    });
    if (!user || user.blockedAt) {
      throw new ForbiddenException({
        code: 'USER_BLOCKED',
        message: 'Учётная запись заблокирована',
      });
    }
    const roles = user.roles.map((r) => r.roleCode);
    const principal: Principal = {
      userId: result.user.id,
      sessionId: result.session.id,
      email: result.user.email,
      roles,
      permissions: permissionsForRoles(roles),
    };
    req.principal = principal;
    return true;
  }

  private assertSameOrigin(req: FastifyRequest): void {
    const expected = this.authService.config.publicUrl;
    const origin = req.headers.origin ?? refererOrigin(req.headers.referer);
    if (origin !== expected) {
      throw new ForbiddenException({
        code: 'CSRF_ORIGIN_MISMATCH',
        message: 'Недопустимый источник запроса',
      });
    }
  }
}

function refererOrigin(referer: string | undefined): string | undefined {
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionCode | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const principal = req.principal;
    if (principal?.permissions.has(required)) return true;
    await this.audit.record({
      action: 'rbac.denied',
      outcome: 'denied',
      actorId: principal?.userId ?? null,
      ipAddress:
        clientIp(
          new Headers({ 'x-forwarded-for': String(req.headers['x-forwarded-for'] ?? '') }),
        ) ?? req.ip,
      requestId: String(req.id),
      metadata: {
        permission: required,
        method: req.method,
        route: req.routeOptions.url ?? req.url,
      },
    });
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Недостаточно прав',
      permission: required,
    });
  }
}

/** Requires a signed-in user. */
export const Authenticated = () => UseGuards(SessionGuard);

/** Requires a signed-in user holding the given permission (checked on the server for every call). */
export const RequirePermission = (permission: PermissionCode) =>
  applyDecorators(
    SetMetadata(PERMISSION_KEY, permission),
    UseGuards(SessionGuard, PermissionGuard),
  );

export const CurrentPrincipal = createParamDecorator(
  (_: unknown, context: ExecutionContext): Principal => {
    const principal = context.switchToHttp().getRequest<FastifyRequest>().principal;
    if (!principal) throw new UnauthorizedException();
    return principal;
  },
);
