import 'reflect-metadata';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.factory.js';
import { MailerService, type MailMessage } from '../src/auth/mailer.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'correct-horse-42';

describe('organization reviews', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  const mail: MailMessage[] = [];
  const run = Date.now().toString(36);
  const email = (name: string) => `${name}-${run}@example.test`;

  async function req(
    method: 'GET' | 'POST' | 'DELETE',
    url: string,
    opts: { cookie?: string; body?: unknown; origin?: string | null } = {},
  ) {
    const headers: Record<string, string> = {
      'x-forwarded-for': `10.6.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
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
    await prisma?.organization.deleteMany({ where: { slug: { startsWith: `rev-${run}` } } });
    await prisma?.user.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
    await app?.close();
  });

  it('premoderates reviews and shows an average only from three approved ones', async () => {
    const owner = await user('owner');
    const mod = await user('mod', 'moderator');
    const residents = [await user('r1'), await user('r2'), await user('r3')];
    const org = await prisma.organization.create({
      data: {
        slug: `rev-${run}`,
        name: '[Тест] Организация',
        description: '[Тест]',
        status: 'published',
        ownerId: owner.id,
      },
    });
    const url = `/api/organizations/${org.id}/reviews`;
    const text = '[Тест] Достаточно длинный текст отзыва.';
    expect((await req('POST', url, { body: { rating: 5, body: text } })).statusCode).toBe(401);
    expect(
      (await req('POST', url, { cookie: owner.cookie, body: { rating: 5, body: text } }))
        .statusCode,
    ).toBe(403);
    const r0 = residents[0]!;
    expect(
      (await req('POST', url, { cookie: r0.cookie, body: { rating: 6, body: text } })).statusCode,
    ).toBe(400);
    expect(
      (await req('POST', url, { cookie: r0.cookie, body: { rating: 4, body: 'коротко' } }))
        .statusCode,
    ).toBe(400);

    const ids: string[] = [];
    for (const [i, r] of residents.entries()) {
      const res = await req('POST', url, { cookie: r.cookie, body: { rating: i + 3, body: text } });
      expect(res.statusCode).toBe(200);
      ids.push(res.json<{ id: string }>().id);
    }
    let pub = (await req('GET', url)).json<{
      summary: { count: number; average: number | null };
    }>();
    expect(pub.summary).toEqual({ count: 0, average: null });

    const queue = await req('GET', '/api/moderation/queue', { cookie: mod.cookie });
    expect(
      queue
        .json<{ items: Array<{ kind: string; id: string }> }>()
        .items.filter((i) => i.kind === 'reviews')
        .map((i) => i.id),
    ).toEqual(expect.arrayContaining(ids));
    expect(
      (
        await req('POST', `/api/moderation/reviews/${ids[0]}/approve`, {
          cookie: r0.cookie,
          body: {},
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await req('POST', `/api/moderation/reviews/${ids[0]}/reject`, {
          cookie: mod.cookie,
          body: {},
        })
      ).statusCode,
    ).toBe(400);

    for (const id of ids.slice(0, 2))
      expect(
        (
          await req('POST', `/api/moderation/reviews/${id}/approve`, {
            cookie: mod.cookie,
            body: {},
          })
        ).statusCode,
      ).toBe(204);
    pub = (await req('GET', url)).json();
    expect(pub.summary).toEqual({ count: 2, average: null });

    await req('POST', `/api/moderation/reviews/${ids[2]}/approve`, {
      cookie: mod.cookie,
      body: {},
    });
    const full = (await req('GET', url, { cookie: r0.cookie })).json<{
      summary: { count: number; average: number | null };
      items: Array<Record<string, unknown>>;
      mine: { status: string };
    }>();
    expect(full.summary).toEqual({ count: 3, average: 4 });
    expect(full.mine.status).toBe('published');
    expect(JSON.stringify(full.items)).not.toContain('@example.test');

    // Editing sends the review back to moderation and hides it.
    await req('POST', url, { cookie: r0.cookie, body: { rating: 1, body: `${text} Изменено.` } });
    expect((await req('GET', url)).json<{ summary: { count: number } }>().summary.count).toBe(2);
    expect((await req('DELETE', `${url}/mine`, { cookie: r0.cookie })).statusCode).toBe(204);
    expect(await prisma.organizationReview.count({ where: { organizationId: org.id } })).toBe(2);
  });
});
