import 'reflect-metadata';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.factory.js';
import { MailerService, type MailMessage } from '../src/auth/mailer.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'correct-horse-42';

describe('unified moderation queue and audit search', () => {
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
      'x-forwarded-for': `10.3.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
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
    await app?.close();
  });

  it('lists every pending kind oldest-first, only for moderators', async () => {
    const author = await user('mq-author');
    const resident = await user('mq-resident');
    const mod = await user('mq-mod', 'moderator');
    const category = await prisma.category.findFirstOrThrow({ where: { module: 'announcements' } });
    const expiresAt = new Date(Date.now() + 7 * 86_400_000);
    const ann = await prisma.announcement.create({
      data: {
        slug: `mq-ann-${run}`,
        title: `[Тест] объявление ${run}`,
        description: 'x'.repeat(400),
        categoryId: category.id,
        authorId: author.id,
        expiresAt,
        createdAt: new Date(Date.now() - 60_000),
      },
    });
    const job = await prisma.job.create({
      data: {
        slug: `mq-job-${run}`,
        title: `[Тест] вакансия ${run}`,
        employer: '[Тест]',
        description: 'Описание',
        authorId: author.id,
        expiresAt,
      },
    });

    expect(
      (await req('GET', '/api/moderation/queue', { cookie: resident.cookie })).statusCode,
    ).toBe(403);
    expect((await req('GET', '/api/moderation/queue')).statusCode).toBe(401);

    const res = await req('GET', '/api/moderation/queue', { cookie: mod.cookie });
    expect(res.statusCode).toBe(200);
    const body = res.json<{
      counts: Record<string, number>;
      items: Array<{ kind: string; id: string; excerpt: string; createdAt: string }>;
    }>();
    expect(Object.keys(body.counts).sort()).toEqual(
      ['announcements', 'groups', 'jobs', 'lost-found', 'posts'].sort(),
    );
    const mine = body.items.filter((i) => i.id === ann.id || i.id === job.id);
    expect(mine.map((i) => i.kind)).toEqual(['announcements', 'jobs']);
    expect(mine[0]!.excerpt.length).toBeLessThanOrEqual(280);
    const times = body.items.map((i) => Date.parse(i.createdAt));
    expect([...times].sort((a, b) => a - b)).toEqual(times);

    for (const [kind, id] of [
      ['announcements', ann.id],
      ['jobs', job.id],
    ])
      expect(
        (
          await req('POST', `/api/moderation/${kind}/${id}/approve`, {
            cookie: mod.cookie,
            body: {},
          })
        ).statusCode,
      ).toBe(204);
    const after = (await req('GET', '/api/moderation/queue', { cookie: mod.cookie })).json<{
      items: Array<{ id: string }>;
    }>();
    expect(after.items.some((i) => i.id === ann.id || i.id === job.id)).toBe(false);

    const audit = await req(
      'GET',
      `/api/admin/audit-log?q=JOB_APPROVED&entityId=${job.id}&outcome=success&after=${new Date(Date.now() - 3_600_000).toISOString()}`,
      { cookie: mod.cookie },
    );
    expect(audit.statusCode).toBe(403);

    const admin = await user('mq-admin', 'admin');
    const found = await req(
      'GET',
      `/api/admin/audit-log?q=JOB_APPROVED&entityId=${job.id}&outcome=success&after=${new Date(Date.now() - 3_600_000).toISOString()}`,
      { cookie: admin.cookie },
    );
    expect(found.statusCode).toBe(200);
    const entries = found.json<Array<{ action: string; actorId: string }>>();
    expect(entries.map((e) => e.action)).toEqual(['moderation.job_approved']);
    expect(entries[0]!.actorId).toBe(mod.id);
    const none = await req(
      'GET',
      `/api/admin/audit-log?entityId=${job.id}&before=${new Date(Date.now() - 3_600_000).toISOString()}`,
      { cookie: admin.cookie },
    );
    expect(none.json()).toEqual([]);
    expect(
      (await req('GET', '/api/admin/audit-log?outcome=bogus', { cookie: admin.cookie })).statusCode,
    ).toBe(400);
  });
});
