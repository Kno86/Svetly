import { Body, Controller, Get, HttpCode, HttpException, Post, Query, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { OptionalAuth, OptionalPrincipal, RequirePermission } from '../auth/guards.js';
import type { Principal } from '../auth/principal.js';
import { parse } from '../common/validation.js';
import { AnalyticsService } from './analytics.service.js';
import { CLIENT_EVENTS, cleanPath, moduleOf, referrerHost } from './events.js';

export const CLIENT_LIMIT = { count: 120, windowMs: 60_000 };
const token = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{1,60}$/);
const clientBody = z.object({
  name: z.enum(CLIENT_EVENTS),
  path: z.string().max(300),
  referrer: z.string().max(500).optional(),
  utm: z
    .object({ source: token.optional(), medium: token.optional(), campaign: token.optional() })
    .optional(),
  kind: z.enum(['phone', 'website', 'email', 'map']).optional(),
  code: token.optional(),
});
const summaryQuery = z.object({ days: z.coerce.number().int().min(1).max(90).default(30) });

@Controller()
export class AnalyticsController {
  /** Per-process window; good enough for one API instance, documented in ANALYTICS.md. */
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly analytics: AnalyticsService) {}

  @Post('analytics/events')
  @HttpCode(204)
  @OptionalAuth()
  async collect(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
    @OptionalPrincipal() p?: Principal,
  ) {
    this.limit(req.ip);
    const data = parse(clientBody, body);
    const path = cleanPath(data.path);
    if (!path) return;
    const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '').split(':')[0];
    await this.analytics.track(data.name, {
      userId: p?.userId,
      path,
      module: moduleOf(path),
      referrerHost: referrerHost(data.referrer, host),
      source: data.utm?.source ?? null,
      medium: data.utm?.medium ?? null,
      campaign: data.utm?.campaign ?? null,
      meta: {
        ...(data.kind ? { kind: data.kind } : {}),
        ...(data.code ? { code: data.code } : {}),
      },
    });
  }

  @Get('admin/analytics')
  @RequirePermission('analytics.read')
  async summary(@Query() query: unknown) {
    const { days } = parse(summaryQuery, query);
    await this.analytics.purge();
    return this.analytics.summary(days);
  }

  private limit(ip: string) {
    const now = Date.now();
    if (this.hits.size > 10_000) this.hits.clear();
    const h = this.hits.get(ip);
    if (!h || h.resetAt <= now) {
      this.hits.set(ip, { count: 1, resetAt: now + CLIENT_LIMIT.windowMs });
      return;
    }
    if (++h.count > CLIENT_LIMIT.count)
      throw new HttpException({ code: 'RATE_LIMITED', message: 'Слишком много событий' }, 429);
  }
}
