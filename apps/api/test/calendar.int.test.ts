import 'reflect-metadata';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.factory.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('events calendar', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);

  beforeAll(async () => {
    app = await createApp('warn');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma?.event.deleteMany({ where: { slug: { startsWith: `cal-${run}-` } } });
    await app?.close();
  });

  const create = (name: string, startsAt: string, endsAt: string | null, status = 'published') =>
    prisma.event.create({
      data: {
        slug: `cal-${run}-${name}`,
        title: `[Тест] ${name}`,
        description: '',
        organizer: '[Тест]',
        location: '[Тест]',
        startsAt: new Date(startsAt),
        endsAt: endsAt ? new Date(endsAt) : null,
        status,
      },
    });

  it('returns events overlapping the month in Novosibirsk time', async () => {
    // 2031-03-01 00:30 local = 2031-02-28 17:30 UTC
    await create('first-night', '2031-02-28T17:30:00Z', null);
    await create('spans-in', '2031-02-25T03:00:00Z', '2031-03-02T10:00:00Z');
    await create('feb-local', '2031-02-28T16:30:00Z', null);
    await create('april', '2031-04-01T03:00:00Z', null);
    await create('draft', '2031-03-10T03:00:00Z', null, 'draft');
    await create('cancelled', '2031-03-11T03:00:00Z', null, 'cancelled');

    const res = await app.inject({ method: 'GET', url: '/api/events/calendar?month=2031-03' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ month: string; truncated: boolean; items: Array<{ slug: string }> }>();
    expect(body.month).toBe('2031-03');
    expect(body.truncated).toBe(false);
    expect(body.items.map((i) => i.slug.replace(`cal-${run}-`, ''))).toEqual([
      'spans-in',
      'first-night',
      'cancelled',
    ]);
  });

  it('rejects malformed months and does not shadow event slugs', async () => {
    for (const month of ['2031-13', '31-03', ''])
      expect(
        (await app.inject({ method: 'GET', url: `/api/events/calendar?month=${month}` }))
          .statusCode,
      ).toBe(400);
    await create('page', '2031-05-01T03:00:00Z', null);
    expect(
      (await app.inject({ method: 'GET', url: `/api/events/cal-${run}-page` })).statusCode,
    ).toBe(200);
  });
});
