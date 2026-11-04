import 'reflect-metadata';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.factory.js';
import { MailerService, type MailMessage } from '../src/auth/mailer.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'correct-horse-42';

describe('public resident profile', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  const mail: MailMessage[] = [];
  const run = Date.now().toString(36);
  const email = (name: string) => `${name}-${run}@example.test`;

  async function req(
    method: 'GET' | 'POST' | 'PUT',
    url: string,
    opts: { cookie?: string; body?: unknown; origin?: string | null } = {},
  ) {
    const headers: Record<string, string> = {
      'x-forwarded-for': `10.4.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
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
    await prisma?.group.deleteMany({ where: { slug: { startsWith: `prof-${run}-` } } });
    await prisma?.user.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
    await app?.close();
  });

  it('is hidden by default and shows only public activity once enabled', async () => {
    const alice = await user('alice');
    const visit = () => req('GET', `/api/residents/${alice.id}`);
    expect((await visit()).statusCode).toBe(404);
    expect((await req('GET', '/api/me/profile', { cookie: alice.cookie })).json()).toEqual({
      id: alice.id,
      isPublic: false,
      bio: '',
    });
    expect((await req('GET', '/api/me/profile')).statusCode).toBe(401);

    const group = (name: string, visibility: string) =>
      prisma.group.create({
        data: {
          slug: `prof-${run}-${name}`,
          name: `[Тест] ${name}`,
          topic: 'other',
          visibility,
          status: 'active',
          createdById: alice.id,
          members: { create: { userId: alice.id, role: 'owner' } },
        },
      });
    const open = await group('open', 'open');
    const closed = await group('closed', 'closed');
    const post = (body: string, groupId: string | null, status = 'published') =>
      prisma.post.create({
        data: { authorId: alice.id, groupId, body, status, publishedAt: new Date() },
      });
    await post('general', null);
    await post('in-open', open.id);
    await post('in-closed', closed.id);
    await post('pending', null, 'pending');

    expect(
      (
        await req('PUT', '/api/me/profile', {
          cookie: alice.cookie,
          body: { isPublic: true, bio: 'x'.repeat(501) },
        })
      ).statusCode,
    ).toBe(400);
    const saved = await req('PUT', '/api/me/profile', {
      cookie: alice.cookie,
      body: { isPublic: true, bio: '  Люблю велосипед  ' },
    });
    expect(saved.json()).toMatchObject({ isPublic: true, bio: 'Люблю велосипед' });

    const res = await visit();
    expect(res.statusCode).toBe(200);
    const body = res.json<
      Record<string, unknown> & { posts: Array<{ body: string }>; groups: Array<{ slug: string }> }
    >();
    expect(Object.keys(body).sort()).toEqual([
      'bio',
      'groups',
      'id',
      'memberSince',
      'name',
      'posts',
    ]);
    expect(JSON.stringify(body)).not.toContain(alice.address);
    expect(body.posts.map((p) => p.body).sort()).toEqual(['general', 'in-open']);
    expect(body.groups.map((g) => g.slug)).toEqual([open.slug]);

    const feed = await req('GET', '/api/feed');
    const mine = feed
      .json<{ items: Array<{ body: string; author: { profileId: string | null } }> }>()
      .items.find((i) => i.body === 'general');
    expect(mine?.author.profileId).toBe(alice.id);

    await prisma.user.update({ where: { id: alice.id }, data: { blockedAt: new Date() } });
    expect((await visit()).statusCode).toBe(404);
    await prisma.user.update({ where: { id: alice.id }, data: { blockedAt: null } });

    await req('PUT', '/api/me/profile', {
      cookie: alice.cookie,
      body: { isPublic: false, bio: '' },
    });
    expect((await visit()).statusCode).toBe(404);
    expect((await req('GET', '/api/residents/not-a-uuid')).statusCode).toBe(400);
  });
});
