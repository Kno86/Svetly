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

describe('core content platform against a real PostgreSQL database', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  const mail: MailMessage[] = [];
  const run = Date.now().toString(36);
  const email = (name: string) => `${name}-${run}@example.test`;

  async function req(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    opts: {
      cookie?: string;
      body?: unknown;
      raw?: Buffer;
      type?: string;
      origin?: string | null;
    } = {},
  ) {
    const headers: Record<string, string> = {
      'x-forwarded-for': `10.1.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    };
    if (opts.origin !== null) headers.origin = opts.origin ?? ORIGIN;
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
    expect(
      (
        await req('POST', '/api/auth/sign-up/email', {
          body: { name: 'Тест', email: address, password: PASSWORD },
        })
      ).statusCode,
    ).toBe(200);
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

  async function categoryId(module: string, slug: string) {
    return (await prisma.category.findUniqueOrThrow({ where: { module_slug: { module, slug } } }))
      .id;
  }

  const ad = (categoryIdValue: string, extra: Record<string, unknown> = {}) => ({
    title: `Продам велосипед ${run}`,
    description: 'Взрослый велосипед, в хорошем состоянии, самовывоз.',
    categoryId: categoryIdValue,
    price: 5000,
    condition: 'used',
    ...extra,
  });

  beforeAll(async () => {
    app = await createApp('warn');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = app.get(PrismaService);
    vi.spyOn(app.get(MailerService), 'send').mockImplementation(async (m) => {
      mail.push(m);
    });
    await prisma.setting.update({
      where: { key: 'moderation.trustedThreshold' },
      data: { value: 3 },
    });
  });

  afterAll(async () => {
    await prisma?.setting.update({
      where: { key: 'moderation.trustedThreshold' },
      data: { value: 3 },
    });
    await app?.close();
  });

  it('seeds navigational categories for every module', async () => {
    const res = await req('GET', '/api/categories?module=announcements');
    expect(res.statusCode).toBe(200);
    expect(res.json().map((c: { slug: string }) => c.slug)).toContain('otdam-darom');
  });

  it('premoderates announcements of new authors and hides them until approved', async () => {
    const author = await user('author');
    const moderator = await user('mod', 'moderator');
    const plain = await user('plain');
    const created = await req('POST', '/api/announcements', {
      cookie: author.cookie,
      body: ad(await categoryId('announcements', 'prodam')),
    });
    expect(created.statusCode).toBe(201);
    const { id, slug, status } = created.json();
    expect(status).toBe('pending');

    expect((await req('GET', `/api/announcements/${slug}`)).statusCode).toBe(404);
    expect(
      (await req('GET', `/api/search?q=велосипед ${run}`))
        .json()
        .items.map((r: { slug: string }) => r.slug),
    ).not.toContain(slug);

    expect(
      (await req('GET', '/api/moderation/announcements', { cookie: plain.cookie })).statusCode,
    ).toBe(403);
    expect(
      (
        await req('POST', `/api/moderation/announcements/${id}/approve`, {
          cookie: plain.cookie,
          body: {},
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await req('POST', `/api/moderation/announcements/${id}/reject`, {
          cookie: moderator.cookie,
          body: {},
        })
      ).statusCode,
    ).toBe(400);

    const queue = await req('GET', '/api/moderation/announcements', { cookie: moderator.cookie });
    expect(queue.json().map((a: { id: string }) => a.id)).toContain(id);
    expect(
      (
        await req('POST', `/api/moderation/announcements/${id}/approve`, {
          cookie: moderator.cookie,
          body: {},
        })
      ).statusCode,
    ).toBe(204);

    const pub = await req('GET', `/api/announcements/${slug}`);
    expect(pub.statusCode).toBe(200);
    expect(pub.json()).not.toHaveProperty('authorId');
    const found = (await req('GET', `/api/search?q=велосипеды&type=announcements`)).json().items;
    expect(found.map((r: { slug: string }) => r.slug)).toContain(slug);
    expect(
      await prisma.auditLog.count({
        where: { entityId: id, action: 'moderation.announcement_approved' },
      }),
    ).toBe(1);
  });

  it('publishes immediately once the author reaches the configurable trust threshold', async () => {
    const author = await user('trusted');
    await prisma.setting.update({
      where: { key: 'moderation.trustedThreshold' },
      data: { value: 0 },
    });
    const res = await req('POST', '/api/announcements', {
      cookie: author.cookie,
      body: ad(await categoryId('announcements', 'otdam-darom'), { price: null }),
    });
    expect(res.json().status).toBe('published');
    await prisma.setting.update({
      where: { key: 'moderation.trustedThreshold' },
      data: { value: 3 },
    });
  });

  it('enforces ownership, validation, categories and CSRF on announcements', async () => {
    const owner = await user('owner');
    const other = await user('other');
    const cat = await categoryId('announcements', 'mebel');
    const { id } = (
      await req('POST', '/api/announcements', { cookie: owner.cookie, body: ad(cat) })
    ).json();

    expect(
      (await req('PATCH', `/api/announcements/${id}`, { cookie: other.cookie, body: ad(cat) }))
        .statusCode,
    ).toBe(404);
    expect(
      (await req('POST', `/api/announcements/${id}/close`, { cookie: other.cookie })).statusCode,
    ).toBe(404);
    expect(
      (await req('GET', `/api/me/announcements/${id}`, { cookie: other.cookie })).statusCode,
    ).toBe(404);
    expect(
      (
        await req('POST', '/api/announcements', {
          cookie: owner.cookie,
          body: ad(cat, { title: 'x' }),
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await req('POST', '/api/announcements', {
          cookie: owner.cookie,
          body: ad(await categoryId('news', 'sport')),
        })
      ).statusCode,
    ).toBe(400);
    expect((await req('POST', '/api/announcements', { body: ad(cat) })).statusCode).toBe(401);
    expect(
      (
        await req('POST', '/api/announcements', {
          cookie: owner.cookie,
          body: ad(cat),
          origin: 'https://evil.example',
        })
      ).statusCode,
    ).toBe(403);

    expect(
      (await req('POST', `/api/announcements/${id}/close`, { cookie: owner.cookie })).statusCode,
    ).toBe(204);
    expect(
      (await req('GET', '/api/me/announcements', { cookie: owner.cookie })).json()[0].status,
    ).toBe('closed');
  });

  it('accepts only real images and lets authors attach only their own media', async () => {
    const owner = await user('media');
    const other = await user('media2');
    expect((await req('POST', '/api/media', { raw: PNG })).statusCode).toBe(401);
    expect(
      (await req('POST', '/api/media', { cookie: owner.cookie, raw: Buffer.from('not an image') }))
        .statusCode,
    ).toBe(400);
    expect(
      (await req('POST', '/api/media', { cookie: owner.cookie, raw: PNG, type: 'image/jpeg' }))
        .statusCode,
    ).toBe(400);
    const up = await req('POST', '/api/media', { cookie: owner.cookie, raw: PNG });
    expect(up.statusCode).toBe(201);
    const { id, url } = up.json();
    const got = await req('GET', url);
    expect(got.statusCode).toBe(200);
    expect(got.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(got.rawPayload, PNG)).toBe(0);

    const cat = await categoryId('announcements', 'drugoe');
    expect(
      (
        await req('POST', '/api/announcements', {
          cookie: other.cookie,
          body: ad(cat, { imageIds: [id] }),
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await req('POST', '/api/announcements', {
          cookie: owner.cookie,
          body: ad(cat, { imageIds: [id] }),
        })
      ).statusCode,
    ).toBe(201);
  });

  it('lets only editors manage news; drafts never leak to public lists or search', async () => {
    const editor = await user('editor', 'editor');
    const plain = await user('reader');
    const body = {
      title: `Ремонт дороги ${run}`,
      excerpt: 'Кратко',
      body: 'Подробный текст о ремонте дорог.',
      status: 'draft',
    };
    expect((await req('POST', '/api/staff/news', { cookie: plain.cookie, body })).statusCode).toBe(
      403,
    );
    const created = await req('POST', '/api/staff/news', { cookie: editor.cookie, body });
    expect(created.statusCode).toBe(201);
    const { id, slug } = created.json();
    expect((await req('GET', `/api/news/${slug}`)).statusCode).toBe(404);
    expect(
      (await req('GET', `/api/search?q=дорог ${run}`))
        .json()
        .items.map((r: { slug: string }) => r.slug),
    ).not.toContain(slug);

    expect(
      (
        await req('PATCH', `/api/staff/news/${id}`, {
          cookie: editor.cookie,
          body: { ...body, status: 'published' },
        })
      ).statusCode,
    ).toBe(200);
    expect((await req('GET', `/api/news/${slug}`)).statusCode).toBe(200);
    const results = (await req('GET', `/api/search?q=ремонт дорог&type=news`)).json().items;
    expect(results.map((r: { slug: string }) => r.slug)).toContain(slug);
    expect(
      (await req('GET', '/api/news')).json().items.map((n: { slug: string }) => n.slug),
    ).toContain(slug);
  });

  it('separates upcoming and past events and enforces capacity', async () => {
    const editor = await user('evteditor', 'editor');
    const a = await user('guest1');
    const b = await user('guest2');
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const past = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const base = {
      description: 'Описание',
      organizer: 'Организатор',
      location: 'Место',
      status: 'published',
    };
    const up = (
      await req('POST', '/api/staff/events', {
        cookie: editor.cookie,
        body: { ...base, title: `Будущее ${run}`, startsAt: future, capacity: 1 },
      })
    ).json();
    const old = (
      await req('POST', '/api/staff/events', {
        cookie: editor.cookie,
        body: { ...base, title: `Прошлое ${run}`, startsAt: past },
      })
    ).json();
    expect(
      (
        await req('POST', '/api/staff/events', {
          cookie: editor.cookie,
          body: { ...base, title: 'Ошибка дат', startsAt: future, endsAt: past },
        })
      ).statusCode,
    ).toBe(400);

    const upcoming = (await req('GET', '/api/events?when=upcoming&limit=50'))
      .json()
      .items.map((e: { id: string }) => e.id);
    expect(upcoming).toContain(up.id);
    expect(upcoming).not.toContain(old.id);
    expect(
      (await req('GET', '/api/events?when=past&limit=50'))
        .json()
        .items.map((e: { id: string }) => e.id),
    ).toContain(old.id);

    expect(
      (await req('POST', `/api/events/${up.id}/registration`, { cookie: a.cookie })).statusCode,
    ).toBe(204);
    expect(
      (await req('POST', `/api/events/${up.id}/registration`, { cookie: a.cookie })).statusCode,
    ).toBe(204);
    const full = await req('POST', `/api/events/${up.id}/registration`, { cookie: b.cookie });
    expect(full.statusCode).toBe(400);
    expect(full.json().code).toBe('EVENT_FULL');
    expect(
      (await req('POST', `/api/events/${old.id}/registration`, { cookie: b.cookie })).statusCode,
    ).toBe(400);
    expect((await req('GET', `/api/events/${up.slug}`)).json().registered).toBe(1);
    expect(
      (await req('DELETE', `/api/events/${up.id}/registration`, { cookie: a.cookie })).statusCode,
    ).toBe(204);
    expect(
      (await req('POST', `/api/events/${up.id}/registration`, { cookie: b.cookie })).statusCode,
    ).toBe(204);
  });

  it('publishes organizations and directory entries only through staff permissions', async () => {
    const editor = await user('orgeditor', 'editor');
    const support = await user('support', 'support');
    const org = {
      kind: 'service',
      name: `Сантехник ${run}`,
      description: 'Описание',
      services: 'замена труб',
      status: 'published',
    };
    expect(
      (await req('POST', '/api/staff/organizations', { cookie: support.cookie, body: org }))
        .statusCode,
    ).toBe(403);
    const created = (
      await req('POST', '/api/staff/organizations', { cookie: editor.cookie, body: org })
    ).json();
    expect(created.verification).toBe('unverified');
    const list = (await req('GET', '/api/organizations?kind=service&limit=50'))
      .json()
      .items.map((o: { slug: string }) => o.slug);
    expect(list).toContain(created.slug);

    const entry = {
      title: `Аварийная служба ${run}`,
      kind: 'emergency',
      phone: '112',
      status: 'draft',
    };
    const d = (
      await req('POST', '/api/staff/directory', { cookie: editor.cookie, body: entry })
    ).json();
    expect(
      (await req('GET', '/api/directory')).json().map((e: { id: string }) => e.id),
    ).not.toContain(d.id);
  });
});
