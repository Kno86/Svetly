import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { findPendingMigrations, listExpectedMigrations } from './migrations.js';

export type CheckStatus = 'ok' | 'error';

export interface ReadinessReport {
  status: CheckStatus;
  checks: {
    database: CheckStatus;
    migrations: CheckStatus;
  };
  pendingMigrations: string[];
}

@Injectable()
export class HealthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async readiness(): Promise<ReadinessReport> {
    let database: CheckStatus = 'ok';
    let migrations: CheckStatus = 'ok';
    let pendingMigrations: string[] = [];

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'error';
    }

    if (database === 'ok') {
      try {
        const rows = await this.prisma.$queryRaw<{ migration_name: string }[]>`
          SELECT migration_name FROM _prisma_migrations
          WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
        const expected = await listExpectedMigrations();
        pendingMigrations = findPendingMigrations(
          expected,
          rows.map((row) => row.migration_name),
        );
        if (pendingMigrations.length > 0) migrations = 'error';
      } catch {
        migrations = 'error';
      }
    } else {
      migrations = 'error';
    }

    return {
      status: database === 'ok' && migrations === 'ok' ? 'ok' : 'error',
      checks: { database, migrations },
      pendingMigrations,
    };
  }
}
