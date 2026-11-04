import 'reflect-metadata';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.factory.js';
import { MailerService, type MailMessage } from '../src/auth/mailer.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'correct-horse-42';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('profile photo', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  const mail: MailMessage[] = [];
  const run = Date.now().toString(36);
  const email = (name: string) => `${name}-${run}@example.test`;

  async function req(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    opts: { cookie?: string; body?: unknown; raw?: Buffer; type?: string } = {},
  ) {
    const headers: Record<string, string> = {
      origin: ORIGIN,
      'x-forwarded-for': `10.6.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    };
    if (opts.cookie) headers.cookie = opts.cookie;
    if (opts.raw) headers['content-type'] = opts.type ?? 'image/png';
    else if (opts.body !== undefined) headers['content-type'] = 'application/json';
    return app.inject({
      method,
      url,
      headers,
      payload: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
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
    return { id: u.id, cookie };
  }

  const avatarOf = async (id: string) =>
    (await prisma.user.findUniqueOrThrow({ where: { id }, select: { avatarId: true } })).avatarId;

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
    await prisma?.user.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
    await app?.close();
  });

  it('uploads, replaces and removes a photo; staff can remove it', async () => {
    expect((await req('PUT', '/api/me/avatar', { raw: PNG })).statusCode).toBe(401);
    const alice = await user('alice');
    const bad = await req('PUT', '/api/me/avatar', {
      cookie: alice.cookie,
      raw: PNG,
      type: 'image/jpeg',
    });
    expect(bad.statusCode).toBe(400);

    const first = await req('PUT', '/api/me/avatar', { cookie: alice.cookie, raw: PNG });
    expect(first.statusCode).toBe(200);
    const firstId = first.json<{ avatarId: string }>().avatarId;
    expect(await avatarOf(alice.id)).toBe(firstId);
    const me = await req('GET', '/api/me', { cookie: alice.cookie });
    expect(me.json().user.avatarId).toBe(firstId);
    expect((await req('GET', `/api/media/${firstId}`)).statusCode).toBe(200);

    const second = await req('PUT', '/api/me/avatar', { cookie: alice.cookie, raw: PNG });
    const secondId = second.json<{ avatarId: string }>().avatarId;
    expect(secondId).not.toBe(firstId);
    expect(await prisma.mediaAsset.findUnique({ where: { id: firstId } })).toBeNull();

    expect((await req('DELETE', '/api/me/avatar', { cookie: alice.cookie })).statusCode).toBe(204);
    expect(await avatarOf(alice.id)).toBeNull();
    expect(await prisma.mediaAsset.findUnique({ where: { id: secondId } })).toBeNull();

    await req('PUT', '/api/me/avatar', { cookie: alice.cookie, raw: PNG });
    const bob = await user('bob');
    const path = `/api/admin/users/${alice.id}/avatar`;
    expect((await req('DELETE', path, { cookie: bob.cookie })).statusCode).toBe(403);
    const admin = await user('admin', 'admin');
    expect((await req('DELETE', path, { cookie: admin.cookie })).statusCode).toBe(204);
    expect(await avatarOf(alice.id)).toBeNull();
    expect((await req('DELETE', path, { cookie: admin.cookie })).statusCode).toBe(404);
  });
});
