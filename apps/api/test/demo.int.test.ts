import 'reflect-metadata';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.factory.js';
import { clearDemo, DEMO_EMAIL, seedDemo } from '../src/demo.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('demo content', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = app.get(PrismaService) as unknown as PrismaClient;
    await clearDemo(prisma);
  });

  afterAll(async () => {
    await clearDemo(prisma);
    await app.close();
  });

  it('adds one labelled record per section and refuses to run twice', async () => {
    const sections = await seedDemo(prisma);
    expect(sections).toHaveLength(12);
    await expect(seedDemo(prisma)).rejects.toThrow(/already exists/);

    const home = await app.inject({ method: 'GET', url: '/api/home' });
    const body = home.json() as { announcements: Array<{ slug: string; isDemo: boolean }> };
    expect(body.announcements.find((a) => a.slug === 'demo-announcement')?.isDemo).toBe(true);

    for (const url of [
      '/api/jobs',
      '/api/lost-found',
      '/api/polls',
      '/api/issues',
      '/api/groups',
    ]) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode, url).toBe(200);
      expect(res.body, url).toContain('Демо:');
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: DEMO_EMAIL },
      select: { accounts: true },
    });
    expect(user.accounts).toHaveLength(0);
  });

  it('removes every demo record and the demo user', async () => {
    expect(await clearDemo(prisma)).toBeGreaterThanOrEqual(12);
    expect(await prisma.user.findUnique({ where: { email: DEMO_EMAIL } })).toBeNull();
    expect(await prisma.announcement.count({ where: { slug: { startsWith: 'demo-' } } })).toBe(0);
    expect(await prisma.issue.count({ where: { title: { startsWith: 'Демо:' } } })).toBe(0);
  });
});
