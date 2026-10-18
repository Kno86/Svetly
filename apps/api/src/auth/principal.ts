import type { PermissionCode } from '../rbac/permissions.js';

export interface Principal {
  userId: string;
  sessionId: string;
  email: string;
  roles: string[];
  permissions: Set<PermissionCode>;
}

declare module 'fastify' {
  interface FastifyRequest {
    principal?: Principal;
  }
}
