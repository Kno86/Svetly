import 'reflect-metadata';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.factory.js';
import { MailerService, type MailMessage } from '../src/auth/mailer.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'correct-horse-42';

describe('self-service data export and account deletion', () => {
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
      'x-forwarded-for': `10.2.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
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

  it('exports only the requester’s own data', async () => {
    const a = await user('export-a');
    const category = await prisma.category.findFirstOrThrow({ where: { module: 'announcements' } });
    const created = await req('POST', '/api/announcements', {
      cookie: a.cookie,
      body: {
        title: `Отдам книги ${run}`,
        description: 'Детские книги, самовывоз.',
        categoryId: category.id,
      },
    });
    expect(created.statusCode).toBe(201);

    expect((await req('GET', '/api/me/export')).statusCode).toBe(401);
    const res = await req('GET', '/api/me/export', { cookie: a.cookie });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    const data = res.json();
    expect(data.user.email).toBe(a.address);
    expect(data.announcements).toHaveLength(1);
    expect(data.messagesSent).toEqual([]);
  });

  it('requires the password, the confirmation word and a same-origin request', async () => {
    const a = await user('guard-a');
    const wrong = await req('POST', '/api/me/delete', {
      cookie: a.cookie,
      body: { password: 'wrong-password-1', confirm: 'УДАЛИТЬ' },
    });
    expect(wrong.statusCode).toBe(403);
    expect(wrong.json().code).toBe('WRONG_PASSWORD');

    const noConfirm = await req('POST', '/api/me/delete', {
      cookie: a.cookie,
      body: { password: PASSWORD, confirm: 'да' },
    });
    expect(noConfirm.statusCode).toBe(400);

    const crossSite = await req('POST', '/api/me/delete', {
      cookie: a.cookie,
      origin: 'https://evil.example',
      body: { password: PASSWORD, confirm: 'УДАЛИТЬ' },
    });
    expect(crossSite.statusCode).toBe(403);
    expect(await prisma.user.count({ where: { id: a.id } })).toBe(1);

    for (let i = 0; i < 4; i++)
      await req('POST', '/api/me/delete', {
        cookie: a.cookie,
        body: { password: 'wrong-password-1', confirm: 'УДАЛИТЬ' },
      });
    const limited = await req('POST', '/api/me/delete', {
      cookie: a.cookie,
      body: { password: PASSWORD, confirm: 'УДАЛИТЬ' },
    });
    expect(limited.statusCode).toBe(429);
  });

  it('refuses to delete staff accounts', async () => {
    const staff = await user('staff', 'moderator');
    const res = await req('POST', '/api/me/delete', {
      cookie: staff.cookie,
      body: { password: PASSWORD, confirm: 'УДАЛИТЬ' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('STAFF_ACCOUNT');
  });

  it('deletes the account, its content and sessions, and hands groups over', async () => {
    const a = await user('delete-a');
    const b = await user('delete-b');
    const category = await prisma.category.findFirstOrThrow({ where: { module: 'announcements' } });
    await req('POST', '/api/announcements', {
      cookie: a.cookie,
      body: {
        title: `Продам санки ${run}`,
        description: 'Почти новые санки, самовывоз.',
        categoryId: category.id,
      },
    });
    const group = await prisma.group.create({
      data: {
        slug: `group-${run}`,
        name: 'Соседи',
        topic: 'neighbors',
        status: 'active',
        createdById: a.id,
        members: {
          create: [
            { userId: a.id, role: 'owner' },
            { userId: b.id, role: 'member' },
          ],
        },
      },
    });
    const solo = await prisma.group.create({
      data: { slug: `solo-${run}`, name: 'Пустая', topic: 'other', createdById: a.id },
    });
    const published = await prisma.organization.create({
      data: {
        slug: `org-${run}`,
        name: 'Мастерская',
        description: 'Ремонт',
        status: 'published',
        ownerId: a.id,
        createdById: a.id,
      },
    });
    const pending = await prisma.organization.create({
      data: {
        slug: `org-p-${run}`,
        name: 'Заявка',
        description: 'Ремонт',
        status: 'pending',
        ownerId: a.id,
        createdById: a.id,
      },
    });

    const res = await req('POST', '/api/me/delete', {
      cookie: a.cookie,
      body: { password: PASSWORD, confirm: 'УДАЛИТЬ' },
    });
    expect(res.statusCode).toBe(200);

    expect(await prisma.user.count({ where: { id: a.id } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: a.id } })).toBe(0);
    expect(await prisma.announcement.count({ where: { authorId: a.id } })).toBe(0);
    expect(await prisma.organization.count({ where: { id: pending.id } })).toBe(0);
    expect(
      await prisma.organization.findUniqueOrThrow({ where: { id: published.id } }),
    ).toMatchObject({ ownerId: null, createdById: null, status: 'published' });
    expect(await prisma.group.findUniqueOrThrow({ where: { id: group.id } })).toMatchObject({
      createdById: b.id,
    });
    expect(
      await prisma.groupMember.findFirstOrThrow({ where: { groupId: group.id, userId: b.id } }),
    ).toMatchObject({ role: 'owner' });
    expect(await prisma.group.count({ where: { id: solo.id } })).toBe(0);
    expect((await req('GET', '/api/me', { cookie: a.cookie })).statusCode).toBe(401);
    expect(
      await prisma.auditLog.count({
        where: { actorId: a.id, action: 'account.deleted', outcome: 'success' },
      }),
    ).toBe(1);
  });
});
