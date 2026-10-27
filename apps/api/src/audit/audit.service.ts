import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { actorHash, eventFromAudit } from '../analytics/events.js';

export type AuditOutcome = 'success' | 'failure' | 'denied';

export interface AuditEntry {
  action: string;
  outcome: AuditOutcome;
  actorId?: string | null;
  entityType?: string;
  entityId?: string;
  ipAddress?: string | null;
  requestId?: string | null;
  /** Never put passwords, tokens or full contact data here. */
  metadata?: Prisma.InputJsonObject;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: entry.action,
        outcome: entry.outcome,
        actorId: entry.actorId ?? null,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        ipAddress: entry.ipAddress ?? null,
        requestId: entry.requestId ?? null,
        metadata: entry.metadata ?? {},
      },
    });
    const event =
      entry.outcome === 'success' ? eventFromAudit(entry.action, entry.entityType) : null;
    if (event)
      await this.prisma.analyticsEvent
        .create({
          data: {
            name: event.name,
            actor: actorHash(entry.actorId),
            entityType: event.entityType ?? entry.entityType ?? null,
            meta: event.meta ?? {},
          },
        })
        .catch(() => undefined);
  }
}
