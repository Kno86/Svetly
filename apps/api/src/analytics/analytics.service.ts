import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { actorHash, type EventName } from './events.js';

export const ANALYTICS_TZ = 'Asia/Novosibirsk';
export const RETENTION_KEY = 'analytics.retentionDays';
export const DEFAULT_RETENTION_DAYS = 180;
/** Aggregates over fewer occurrences are hidden so single people cannot be singled out. */
export const MIN_GROUP = 2;

export interface TrackInput {
  userId?: string | null;
  module?: string | null;
  path?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  referrerHost?: string | null;
  query?: string | null;
  results?: number | null;
  meta?: Prisma.InputJsonObject;
}

export async function retentionDays(prisma: PrismaService): Promise<number> {
  const s = await prisma.setting.findUnique({ where: { key: RETENTION_KEY } });
  const v = Number(s?.value);
  return Number.isInteger(v) && v >= 30 && v <= 730 ? v : DEFAULT_RETENTION_DAYS;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Best effort: analytics must never break the user action that triggered it. */
  async track(name: EventName, input: TrackInput = {}): Promise<void> {
    const { userId, meta, ...rest } = input;
    try {
      await this.prisma.analyticsEvent.create({
        data: { name, actor: actorHash(userId), meta: meta ?? {}, ...rest },
      });
    } catch (error) {
      this.logger.warn(`analytics event ${name} not stored: ${(error as Error).message}`);
    }
  }

  async purge(): Promise<number> {
    const days = await retentionDays(this.prisma);
    const { count } = await this.prisma.analyticsEvent.deleteMany({
      where: { occurredAt: { lt: new Date(Date.now() - days * 86_400_000) } },
    });
    return count;
  }

  async summary(days: number) {
    const since = new Date(Date.now() - days * 86_400_000);
    const tz = ANALYTICS_TZ;
    const [daily, totals, active, modules, sources, searches, zero, retention] = await Promise.all([
      this.prisma.$queryRaw<Array<{ day: string; name: string; count: bigint }>>`
        SELECT to_char((occurred_at AT TIME ZONE ${tz})::date, 'YYYY-MM-DD') AS day, name, count(*) AS count
        FROM analytics_events WHERE occurred_at >= ${since} GROUP BY 1, 2 ORDER BY 1, 2`,
      this.prisma.$queryRaw<Array<{ name: string; count: bigint }>>`
        SELECT name, count(*) AS count FROM analytics_events WHERE occurred_at >= ${since}
        GROUP BY 1 ORDER BY 2 DESC`,
      this.prisma.$queryRaw<Array<{ dau: bigint; wau: bigint; mau: bigint }>>`
        SELECT
          count(DISTINCT actor) FILTER (WHERE (occurred_at AT TIME ZONE ${tz})::date = (now() AT TIME ZONE ${tz})::date) AS dau,
          count(DISTINCT actor) FILTER (WHERE occurred_at >= now() - interval '7 days') AS wau,
          count(DISTINCT actor) FILTER (WHERE occurred_at >= now() - interval '30 days') AS mau
        FROM analytics_events WHERE actor IS NOT NULL AND occurred_at >= now() - interval '30 days'`,
      this.prisma.$queryRaw<Array<{ module: string; count: bigint }>>`
        SELECT module, count(*) AS count FROM analytics_events
        WHERE name = 'page_view' AND occurred_at >= ${since} AND module IS NOT NULL
        GROUP BY 1 ORDER BY 2 DESC LIMIT 20`,
      this.prisma.$queryRaw<Array<{ source: string; medium: string | null; count: bigint }>>`
        SELECT coalesce(source, referrer_host) AS source, medium, count(*) AS count FROM analytics_events
        WHERE name = 'page_view' AND occurred_at >= ${since} AND coalesce(source, referrer_host) IS NOT NULL
        GROUP BY 1, 2 HAVING count(*) >= ${MIN_GROUP} ORDER BY 3 DESC LIMIT 20`,
      this.prisma.$queryRaw<Array<{ query: string; count: bigint }>>`
        SELECT query, count(*) AS count FROM analytics_events
        WHERE name = 'search' AND occurred_at >= ${since} AND query IS NOT NULL
        GROUP BY 1 HAVING count(*) >= ${MIN_GROUP} ORDER BY 2 DESC LIMIT 20`,
      this.prisma.$queryRaw<Array<{ query: string; count: bigint }>>`
        SELECT query, count(*) AS count FROM analytics_events
        WHERE name = 'search' AND occurred_at >= ${since} AND query IS NOT NULL AND results = 0
        GROUP BY 1 HAVING count(*) >= ${MIN_GROUP} ORDER BY 2 DESC LIMIT 20`,
      retentionDays(this.prisma),
    ]);
    const n = (v: bigint | undefined) => Number(v ?? 0);
    return {
      timezone: tz,
      days,
      since: since.toISOString(),
      retentionDays: retention,
      active: { dau: n(active[0]?.dau), wau: n(active[0]?.wau), mau: n(active[0]?.mau) },
      totals: totals.map((r) => ({ name: r.name, count: n(r.count) })),
      daily: daily.map((r) => ({ day: r.day, name: r.name, count: n(r.count) })),
      modules: modules.map((r) => ({ module: r.module, count: n(r.count) })),
      sources: sources.map((r) => ({ source: r.source, medium: r.medium, count: n(r.count) })),
      searches: searches.map((r) => ({ query: r.query, count: n(r.count) })),
      zeroResults: zero.map((r) => ({ query: r.query, count: n(r.count) })),
    };
  }
}
