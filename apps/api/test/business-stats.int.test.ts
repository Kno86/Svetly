import 'reflect-metadata';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.factory.js';
import { MailerService, type MailMessage } from '../src/auth/mailer.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'correct-horse-42';

describe('business card statistics', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  const mail: MailMessage[] = [];
  const run = Date.now().toString(36);
  const email = (name: string) => `${name}-${run}@example.test`;

  async function req(
    method: 'GET' | 'POST',
    url: string,
    opts: { cookie?: string; body?: unknown; origin?: string | null } = {},
  ) {
    const headers: Record<string, string> = {
      'x-forwarded-for': `10.5.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    };
    if (opts.origin !== null) headers.origin = opts.origin ?? ORIGIN;
    if (opts.cookie) headers.cookie = opts.cookie;
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    return app.inject({
      method,
      url,
      headers,
      payload: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  }

  async function user(name: string, role?: string) {
    const address = email(name);
    await req('POST', '/api/auth/sign-up/email', {
      body: { name: 'Тест', email: address, password: PASSWORD },
    });
    const link = new URL(
      [...mail]
        .reverse()
        .find((m) => m.to === address)!
        .text.match(/https?:\/\/\S+/)![0],
    );
    await req('GET', link.pathname + link.search);
    const u = await prisma.user.findUniqueOrThrow({ where: { email: address } });
    if (role) await prisma.userRole.create({ data: { userId: u.id, roleCode: role } });
    const res = await req('POST', '/api/auth/sign-in/email', {
      body: { email: address, password: PASSWORD },
    });
    const cookie = [res.headers['set-cookie']]
      .flat()
      .filter(Boolean)
      .map((c) => String(c).split(';')[0])
      .join('; ');
    return { id: u.id, address, cookie };
  }

  beforeAll(async () => {
    app = await createApp('warn');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = app.get(PrismaService);
    vi.spyOn(app.get(MailerService), 'send').mockImplementation(async (m) => {
      mail.push(m);
    });
  });

  afterAll(async () => {
    await prisma?.organization.deleteMany({ where: { slug: { startsWith: `stats-${run}` } } });
    await prisma?.analyticsEvent.deleteMany({ where: { path: { contains: `stats-${run}` } } });
    await prisma?.user.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
    await app?.close();
  });

  it('counts views, contact clicks and inquiries for the owner only', async () => {
    const owner = await user('owner');
    const other = await user('other');
    const slug = `stats-${run}`;
    const org = await prisma.organization.create({
      data: {
        slug,
        name: '[Тест] Организация',
        description: '[Тест]',
        status: 'published',
        ownerId: owner.id,
      },
    });
    const path = `/organizations/${slug}`;
    const old = new Date(Date.now() - 40 * 86_400_000);
    await prisma.analyticsEvent.createMany({
      data: [
        { name: 'page_view', path },
        { name: 'page_view', path },
        { name: 'page_view', path, occurredAt: old },
        { name: 'contact_click', path },
        { name: 'page_view', path: `${path}-other` },
      ],
    });
    expect(
      (
        await req('POST', `/api/organizations/${org.id}/inquiries`, {
          cookie: other.cookie,
          body: { message: '[Тест] Вопрос по услуге' },
        })
      ).statusCode,
    ).toBe(201);

    const url = `/api/business/organizations/${org.id}/stats`;
    expect((await req('GET', url)).statusCode).toBe(401);
    expect((await req('GET', url, { cookie: other.cookie })).statusCode).toBe(404);
    expect((await req('GET', `${url}?days=13`, { cookie: owner.cookie })).statusCode).toBe(400);

    const month = await req('GET', url, { cookie: owner.cookie });
    expect(month.statusCode).toBe(200);
    const body = month.json<{
      days: number;
      published: boolean;
      totals: Record<string, number>;
      daily: Array<{ day: string }>;
    }>();
    expect(body.days).toBe(30);
    expect(body.published).toBe(true);
    expect(body.daily).toHaveLength(30);
    expect(body.totals).toEqual({ views: 2, contactClicks: 1, inquiries: 1 });

    const quarter = await req('GET', `${url}?days=90`, { cookie: owner.cookie });
    expect(quarter.json<{ totals: { views: number } }>().totals.views).toBe(3);
  });
});
