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
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
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

  describe('admin platform (PHASE 5)', () => {
    const newsBody = (title: string, status: string) => ({
      title,
      excerpt: 'Кратко',
      body: 'Текст новости для проверки жалоб.',
      status,
    });

    it('accepts complaints only on published content and lets staff resolve them with a note', async () => {
      const editor = await user('cmp-editor', 'editor');
      const resident = await user('cmp-resident');
      const moderator = await user('cmp-mod', 'moderator');
      const published = (
        await req('POST', '/api/staff/news', {
          cookie: editor.cookie,
          body: newsBody(`Жалоба опубликованная ${run}`, 'published'),
        })
      ).json();
      const draft = (
        await req('POST', '/api/staff/news', {
          cookie: editor.cookie,
          body: newsBody(`Жалоба черновик ${run}`, 'draft'),
        })
      ).json();
      const complaint = { entityType: 'news', entityId: published.id, reason: 'wrong_info' };

      expect((await req('POST', '/api/complaints', { body: complaint })).statusCode).toBe(401);
      expect(
        (
          await req('POST', '/api/complaints', {
            cookie: resident.cookie,
            body: { ...complaint, entityId: draft.id },
          })
        ).statusCode,
      ).toBe(404);
      const first = await req('POST', '/api/complaints', {
        cookie: resident.cookie,
        body: complaint,
      });
      expect(first.statusCode).toBe(201);
      const again = await req('POST', '/api/complaints', {
        cookie: resident.cookie,
        body: complaint,
      });
      expect(again.json().id).toBe(first.json().id);

      expect(
        (await req('GET', '/api/admin/complaints', { cookie: resident.cookie })).statusCode,
      ).toBe(403);
      const queue = await req('GET', '/api/admin/complaints', { cookie: moderator.cookie });
      expect(queue.statusCode).toBe(200);
      const entry = queue.json().find((c: { id: string }) => c.id === first.json().id);
      expect(entry.target.title).toBe(published.title);

      const url = `/api/admin/complaints/${first.json().id}/resolve`;
      expect(
        (await req('POST', url, { cookie: moderator.cookie, body: { decision: 'resolved' } }))
          .statusCode,
      ).toBe(400);
      expect(
        (
          await req('POST', url, {
            cookie: moderator.cookie,
            body: { decision: 'resolved', note: 'Исправлено редакцией' },
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await req('POST', url, {
            cookie: moderator.cookie,
            body: { decision: 'dismissed', note: 'Повтор' },
          })
        ).statusCode,
      ).toBe(404);
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'complaint.resolved', entityId: first.json().id },
      });
      expect(audit?.actorId).toBe(moderator.id);
    });

    it('lets admins change the trusted threshold, which immediately affects premoderation', async () => {
      const admin = await user('set-admin', 'admin');
      const moderator = await user('set-mod', 'moderator');
      expect(
        (await req('GET', '/api/admin/settings', { cookie: moderator.cookie })).statusCode,
      ).toBe(403);
      expect(
        (
          await req('PATCH', '/api/admin/settings', {
            cookie: admin.cookie,
            body: { trustedThreshold: -1 },
          })
        ).statusCode,
      ).toBe(400);
      const res = await req('PATCH', '/api/admin/settings', {
        cookie: admin.cookie,
        body: { trustedThreshold: 0 },
      });
      expect(res.statusCode).toBe(200);
      try {
        const author = await user('set-author');
        const created = await req('POST', '/api/announcements', {
          cookie: author.cookie,
          body: ad(await categoryId('announcements', 'prodam'), { title: `Сразу ${run}` }),
        });
        expect(created.json().status).toBe('published');
      } finally {
        await req('PATCH', '/api/admin/settings', {
          cookie: admin.cookie,
          body: { trustedThreshold: 3 },
        });
      }
      expect(
        (await req('GET', '/api/admin/settings', { cookie: admin.cookie })).json().trustedThreshold,
      ).toBe(3);
    });

    it('manages categories and organization verification with separate permissions', async () => {
      const admin = await user('cat-admin', 'admin');
      const editor = await user('cat-editor', 'editor');
      const slug = `test-${run}`;
      const body = { module: 'news', slug, name: 'Тестовая категория' };
      expect(
        (await req('POST', '/api/admin/categories', { cookie: editor.cookie, body })).statusCode,
      ).toBe(403);
      const created = await req('POST', '/api/admin/categories', { cookie: admin.cookie, body });
      expect(created.statusCode).toBe(201);
      expect(
        (await req('POST', '/api/admin/categories', { cookie: admin.cookie, body })).statusCode,
      ).toBe(409);
      const patched = await req('PATCH', `/api/admin/categories/${created.json().id}`, {
        cookie: admin.cookie,
        body: { active: false },
      });
      expect(patched.json().active).toBe(false);

      const org = (
        await req('POST', '/api/staff/organizations', {
          cookie: editor.cookie,
          body: { name: `Проверка ${run}`, description: 'Описание', status: 'published' },
        })
      ).json();
      expect(org.verification).toBe('unverified');
      const url = `/api/admin/organizations/${org.id}/verification`;
      expect(
        (await req('POST', url, { cookie: editor.cookie, body: { verification: 'verified' } }))
          .statusCode,
      ).toBe(403);
      const verified = await req('POST', url, {
        cookie: admin.cookie,
        body: { verification: 'verified', sourceName: 'Звонок в организацию' },
      });
      expect(verified.json().verification).toBe('verified');
      expect(verified.json().checkedAt).toBeTruthy();
    });

    it('shows dashboard counters only for permissions the caller holds', async () => {
      const resident = await user('dash-resident');
      const moderator = await user('dash-mod', 'moderator');
      expect(
        (await req('GET', '/api/admin/dashboard', { cookie: resident.cookie })).statusCode,
      ).toBe(403);
      const res = await req('GET', '/api/admin/dashboard', { cookie: moderator.cookie });
      expect(res.statusCode).toBe(200);
      const { counters } = res.json();
      expect(counters).toHaveProperty('pendingAnnouncements');
      expect(counters).toHaveProperty('openComplaints');
      expect(counters).not.toHaveProperty('draftNews');
    });
  });

  describe('business cabinet and community (PHASE 6)', () => {
    it('premoderates jobs and lost & found, hides phones in lists and enforces moderation rights', async () => {
      const author = await user('p6-author');
      const mod = await user('p6-mod', 'moderator');
      const job = await req('POST', '/api/jobs', {
        cookie: author.cookie,
        body: {
          title: 'Продавец в магазин',
          employer: 'Магазин у дома',
          description: 'Работа в смену, обучение на месте.',
          contactPhone: '+7 900 000-00-00',
        },
      });
      expect(job.statusCode).toBe(201);
      expect(job.json().status).toBe('pending');
      expect((await req('GET', `/api/jobs/${job.json().slug}`)).statusCode).toBe(404);
      expect((await req('GET', '/api/moderation/jobs', { cookie: author.cookie })).statusCode).toBe(
        403,
      );
      expect(
        (
          await req('POST', `/api/moderation/jobs/${job.json().id}/reject`, {
            cookie: mod.cookie,
            body: {},
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await req('POST', `/api/moderation/jobs/${job.json().id}/approve`, {
            cookie: mod.cookie,
            body: {},
          })
        ).statusCode,
      ).toBe(204);
      const list = (await req('GET', '/api/jobs')).json();
      const listed = list.items.find((j: { slug: string }) => j.slug === job.json().slug);
      expect(listed).toBeDefined();
      expect(listed).not.toHaveProperty('contactPhone');
      const detail = (await req('GET', `/api/jobs/${job.json().slug}`)).json();
      expect(detail.contactPhone).toBe('+7 900 000-00-00');
      expect(detail).not.toHaveProperty('authorId');

      const lost = await req('POST', '/api/lost-found', {
        cookie: author.cookie,
        body: {
          kind: 'lost',
          subject: 'animal',
          title: 'Пропал рыжий кот',
          description: 'Ушёл вечером, откликается на Барсик.',
        },
      });
      expect(lost.statusCode).toBe(201);
      const other = await user('p6-other');
      expect(
        (await req('POST', `/api/lost-found/${lost.json().id}/close`, { cookie: other.cookie }))
          .statusCode,
      ).toBe(404);
      await req('POST', `/api/moderation/lost-found/${lost.json().id}/approve`, {
        cookie: mod.cookie,
        body: {},
      });
      expect(
        (await req('POST', `/api/lost-found/${lost.json().id}/resolve`, { cookie: author.cookie }))
          .statusCode,
      ).toBe(204);
      expect((await req('GET', `/api/lost-found/${lost.json().slug}`)).statusCode).toBe(404);
    });

    it('keeps issues private by default and limits public answers to issues.respond', async () => {
      const resident = await user('p6-resident');
      const support = await user('p6-support', 'support');
      const admin = await user('p6-admin', 'admin');
      const priv = await req('POST', '/api/issues', {
        cookie: resident.cookie,
        body: {
          category: 'lighting',
          title: 'Не горит фонарь',
          description: 'Фонарь у остановки не горит неделю.',
          contact: 'tg @resident',
        },
      });
      expect(priv.statusCode).toBe(201);
      expect((await req('GET', `/api/issues/${priv.json().number}`)).statusCode).toBe(404);
      const pub = await req('POST', '/api/issues', {
        cookie: resident.cookie,
        body: {
          category: 'roads',
          title: 'Яма на дороге',
          description: 'Глубокая яма на въезде в посёлок.',
          isPublic: true,
          contact: 'secret',
        },
      });
      const shown = (await req('GET', `/api/issues/${pub.json().number}`)).json();
      expect(shown).not.toHaveProperty('contact');
      expect(shown).not.toHaveProperty('reporterId');
      expect((await req('GET', '/api/admin/issues', { cookie: resident.cookie })).statusCode).toBe(
        403,
      );
      const id = pub.json().id;
      expect(
        (
          await req('PATCH', `/api/admin/issues/${id}`, {
            cookie: support.cookie,
            body: { status: 'rejected' },
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await req('PATCH', `/api/admin/issues/${id}`, {
            cookie: support.cookie,
            body: { status: 'in_progress', note: 'Передано мастеру' },
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await req('POST', `/api/admin/issues/${id}/comments`, {
            cookie: support.cookie,
            body: { body: 'Внутренняя заметка' },
          })
        ).statusCode,
      ).toBe(201);
      expect(
        (
          await req('POST', `/api/admin/issues/${id}/comments`, {
            cookie: support.cookie,
            body: { body: 'Публичный ответ', public: true },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await req('POST', `/api/admin/issues/${id}/comments`, {
            cookie: admin.cookie,
            body: { body: 'Ответ платформы', public: true },
          })
        ).statusCode,
      ).toBe(201);
      const mine = (await req('GET', `/api/me/issues/${id}`, { cookie: resident.cookie })).json();
      expect(mine.status).toBe('in_progress');
      expect(mine.updates.map((u: { kind: string }) => u.kind)).toEqual([
        'created',
        'status',
        'official',
      ]);
      expect(
        (await req('GET', `/api/me/issues/${id}`, { cookie: support.cookie })).statusCode,
      ).toBe(404);
    });

    it('allows one vote per account, hides results until close and voters in anonymous mode', async () => {
      const editor = await user('p6-editor', 'editor');
      const voter = await user('p6-voter');
      const now = Date.now();
      expect(
        (await req('POST', '/api/staff/polls', { cookie: voter.cookie, body: {} })).statusCode,
      ).toBe(403);
      const poll = await req('POST', '/api/staff/polls', {
        cookie: editor.cookie,
        body: {
          title: 'Где поставить лавочки?',
          opensAt: new Date(now - 60_000).toISOString(),
          closesAt: new Date(now + 86_400_000).toISOString(),
          status: 'published',
          options: ['У школы', 'У пруда'],
        },
      });
      expect(poll.statusCode).toBe(201);
      const { slug, id, options } = poll.json();
      expect((await req('GET', `/api/polls/${slug}`)).json().results).toBeNull();
      expect(
        (await req('POST', `/api/polls/${slug}/vote`, { body: { optionId: options[0].id } }))
          .statusCode,
      ).toBe(401);
      const first = await req('POST', `/api/polls/${slug}/vote`, {
        cookie: voter.cookie,
        body: { optionId: options[0].id },
      });
      expect(first.statusCode).toBe(200);
      expect(first.json().results.total).toBe(1);
      expect(
        (
          await req('POST', `/api/polls/${slug}/vote`, {
            cookie: voter.cookie,
            body: { optionId: options[1].id },
          })
        ).statusCode,
      ).toBe(409);
      expect(
        (
          await req('PATCH', `/api/staff/polls/${id}`, {
            cookie: editor.cookie,
            body: { options: ['А', 'Б'] },
          })
        ).statusCode,
      ).toBe(409);
      expect(
        (await req('GET', `/api/staff/polls/${id}/results`, { cookie: editor.cookie })).json()
          .voters,
      ).toBeNull();
    });

    it('publishes business cards and owner changes only after review', async () => {
      const owner = await user('p6-owner');
      const resident = await user('p6-client');
      const admin = await user('p6-reviewer', 'admin');
      const app = await req('POST', '/api/business/organizations', {
        cookie: owner.cookie,
        body: {
          kind: 'service',
          name: 'Ремонт обуви',
          description: 'Ремонт и чистка обуви, замена набоек и молний.',
          phone: '+7 900 111-22-33',
        },
      });
      expect(app.statusCode).toBe(201);
      const { id, slug } = app.json();
      expect((await req('GET', `/api/organizations/${slug}`)).statusCode).toBe(404);
      expect(
        (await req('GET', `/api/business/organizations/${id}`, { cookie: resident.cookie }))
          .statusCode,
      ).toBe(404);
      expect(
        (await req('GET', '/api/admin/business/applications', { cookie: owner.cookie })).statusCode,
      ).toBe(403);
      expect(
        (
          await req('POST', `/api/admin/business/applications/${id}/reject`, {
            cookie: admin.cookie,
            body: {},
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await req('POST', `/api/admin/business/applications/${id}/approve`, {
            cookie: admin.cookie,
            body: {},
          })
        ).statusCode,
      ).toBe(200);
      const card = (await req('GET', `/api/organizations/${slug}`)).json();
      expect(card.acceptsInquiries).toBe(true);
      expect(card).not.toHaveProperty('ownerId');

      const edit = await req('PATCH', `/api/business/organizations/${id}`, {
        cookie: owner.cookie,
        body: {
          kind: 'service',
          name: 'Ремонт обуви и сумок',
          description: 'Ремонт и чистка обуви, замена набоек и молний.',
        },
      });
      expect(edit.json().pendingChanges).toBe(true);
      expect((await req('GET', `/api/organizations/${slug}`)).json().name).toBe('Ремонт обуви');
      await req('POST', `/api/admin/business/applications/${id}/approve`, {
        cookie: admin.cookie,
        body: {},
      });
      expect((await req('GET', `/api/organizations/${slug}`)).json().name).toBe(
        'Ремонт обуви и сумок',
      );

      const inq = await req('POST', `/api/organizations/${id}/inquiries`, {
        cookie: resident.cookie,
        body: { message: 'Можно ли заменить молнию на куртке?' },
      });
      expect(inq.statusCode).toBe(201);
      expect(
        (
          await req('POST', `/api/organizations/${id}/inquiries`, {
            cookie: owner.cookie,
            body: { message: 'Сам себе пишу заявку' },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await req('POST', `/api/business/inquiries/${inq.json().id}/reply`, {
            cookie: resident.cookie,
            body: { reply: 'Ответ' },
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (
          await req('POST', `/api/business/inquiries/${inq.json().id}/reply`, {
            cookie: owner.cookie,
            body: { reply: 'Да, приходите.' },
          })
        ).statusCode,
      ).toBe(200);
      const sent = (await req('GET', '/api/me/inquiries', { cookie: resident.cookie })).json();
      expect(sent[0].reply).toBe('Да, приходите.');
    });
  });
  describe('social modules (PHASE 7a)', () => {
    it('premoderates new authors, keeps closed groups private and enforces group roles', async () => {
      const owner = await user('p7-owner');
      const outsider = await user('p7-out');
      const joiner = await user('p7-join');
      const mod = await user('p7-mod', 'moderator');

      const g = await req('POST', '/api/groups', {
        cookie: owner.cookie,
        body: {
          name: 'Соседи тестовой улицы',
          description: 'Группа для проверки.',
          topic: 'neighbors',
          visibility: 'closed',
        },
      });
      expect(g.statusCode).toBe(201);
      expect(g.json().status).toBe('pending');
      const { id: groupId, slug } = g.json();
      expect((await req('GET', `/api/groups/${slug}`)).statusCode).toBe(404);
      expect(
        (
          await req('POST', `/api/moderation/groups/${groupId}/approve`, {
            cookie: owner.cookie,
            body: {},
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await req('POST', `/api/moderation/groups/${groupId}/approve`, {
            cookie: mod.cookie,
            body: {},
          })
        ).statusCode,
      ).toBe(200);

      expect(
        (await req('POST', `/api/groups/${slug}/join`, { cookie: joiner.cookie, body: {} })).json()
          .status,
      ).toBe('pending');
      expect(
        (await req('GET', `/api/groups/${slug}/posts`, { cookie: joiner.cookie })).statusCode,
      ).toBe(403);
      expect(
        (await req('GET', `/api/groups/${slug}/members`, { cookie: joiner.cookie })).statusCode,
      ).toBe(404);
      expect(
        (
          await req('POST', `/api/groups/${slug}/members/${joiner.id}/approve`, {
            cookie: outsider.cookie,
            body: {},
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (
          await req('POST', `/api/groups/${slug}/members/${joiner.id}/approve`, {
            cookie: owner.cookie,
            body: {},
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await req('POST', `/api/groups/${slug}/members/${owner.id}/ban`, {
            cookie: owner.cookie,
            body: {},
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (await req('POST', `/api/groups/${slug}/leave`, { cookie: owner.cookie, body: {} }))
          .statusCode,
      ).toBe(409);

      expect(
        (
          await req('POST', '/api/posts', {
            cookie: outsider.cookie,
            body: { groupId, body: 'Чужой пост' },
          })
        ).statusCode,
      ).toBe(403);
      const post = await req('POST', '/api/posts', {
        cookie: joiner.cookie,
        body: { groupId, body: 'Пост участника' },
      });
      expect(post.json().status).toBe('pending');
      const postId = post.json().id;
      expect(
        (await req('GET', `/api/posts/${postId}`, { cookie: outsider.cookie })).statusCode,
      ).toBe(404);
      expect(
        (await req('GET', `/api/posts/${postId}`, { cookie: joiner.cookie })).json().mine,
      ).toBe(true);
      expect(
        (
          await req('POST', `/api/moderation/posts/${postId}/reject`, {
            cookie: mod.cookie,
            body: {},
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await req('POST', `/api/moderation/posts/${postId}/approve`, {
            cookie: mod.cookie,
            body: {},
          })
        ).statusCode,
      ).toBe(200);

      const feed = (await req('GET', '/api/feed')).json();
      expect(feed.items.some((x: { id: string }) => x.id === postId)).toBe(false);
      const mine = (await req('GET', '/api/feed?scope=groups', { cookie: joiner.cookie })).json();
      const item = mine.items.find((x: { id: string }) => x.id === postId);
      expect(item).toBeDefined();
      expect(item).not.toHaveProperty('authorId');
      expect((await req('GET', `/api/posts/${postId}`)).statusCode).toBe(404);
      expect(
        (
          await req('POST', '/api/complaints', {
            cookie: outsider.cookie,
            body: { entityType: 'post', entityId: postId, reason: 'spam' },
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (
          await req('POST', '/api/favorites', {
            cookie: outsider.cookie,
            body: { entityType: 'post', entityId: postId },
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (await req('PUT', `/api/posts/${postId}/reaction`, { cookie: outsider.cookie })).statusCode,
      ).toBe(404);
      expect(
        (
          await req('POST', `/api/posts/${postId}/comments`, {
            cookie: outsider.cookie,
            body: { body: 'Привет' },
          })
        ).statusCode,
      ).toBe(404);

      expect(
        (await req('POST', `/api/posts/${postId}/pin`, { cookie: joiner.cookie, body: {} }))
          .statusCode,
      ).toBe(404);
      expect(
        (await req('POST', `/api/posts/${postId}/pin`, { cookie: owner.cookie, body: {} })).json()
          .pinned,
      ).toBe(true);
      expect(
        (
          await req('POST', `/api/posts/${postId}/remove`, {
            cookie: owner.cookie,
            body: { note: 'Не по теме группы' },
          })
        ).statusCode,
      ).toBe(200);
      expect((await req('GET', `/api/posts/${postId}`, { cookie: owner.cookie })).statusCode).toBe(
        404,
      );
      expect(
        (await req('GET', '/api/me/posts', { cookie: joiner.cookie })).json()[0].moderationNote,
      ).toBe('Не по теме группы');
    });

    it('limits comments, toggles one reaction per user and keeps favorites private', async () => {
      const author = await user('p7-feed');
      const reader = await user('p7-reader');
      const mod = await user('p7-feedmod', 'moderator');
      const post = await req('POST', '/api/posts', {
        cookie: author.cookie,
        body: { body: 'Общий пост', link: 'https://example.org/x' },
      });
      const id = post.json().id;
      expect(
        (
          await req('POST', '/api/posts', {
            cookie: author.cookie,
            body: { body: 'Ссылка', link: 'javascript:alert(1)' },
          })
        ).statusCode,
      ).toBe(400);
      await req('POST', `/api/moderation/posts/${id}/approve`, { cookie: mod.cookie, body: {} });
      expect((await req('GET', `/api/posts/${id}`)).json().canComment).toBe(false);

      expect(
        (await req('PUT', `/api/posts/${id}/reaction`, { cookie: reader.cookie })).json(),
      ).toEqual({ liked: true, reactions: 1 });
      expect(
        (await req('PUT', `/api/posts/${id}/reaction`, { cookie: reader.cookie })).json().reactions,
      ).toBe(1);
      expect(
        (await req('DELETE', `/api/posts/${id}/reaction`, { cookie: reader.cookie })).json()
          .reactions,
      ).toBe(0);

      const c = await req('POST', `/api/posts/${id}/comments`, {
        cookie: reader.cookie,
        body: { body: 'Первый' },
      });
      expect(c.statusCode).toBe(201);
      const reply = await req('POST', `/api/posts/${id}/comments`, {
        cookie: author.cookie,
        body: { body: 'Ответ', parentId: c.json().id },
      });
      expect(
        (
          await req('POST', `/api/posts/${id}/comments`, {
            cookie: reader.cookie,
            body: { body: 'Вложенный', parentId: reply.json().id },
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await req('PATCH', `/api/comments/${c.json().id}`, {
            cookie: author.cookie,
            body: { body: 'Чужая правка' },
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (
          await req('POST', `/api/comments/${c.json().id}/remove`, {
            cookie: author.cookie,
            body: { note: 'Удалить' },
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (
          await req('POST', `/api/comments/${c.json().id}/remove`, {
            cookie: mod.cookie,
            body: { note: 'Оскорбление' },
          })
        ).statusCode,
      ).toBe(200);
      for (let n = 0; n < 9; n++)
        await req('POST', `/api/posts/${id}/comments`, {
          cookie: reader.cookie,
          body: { body: `Комментарий ${n}` },
        });
      expect(
        (
          await req('POST', `/api/posts/${id}/comments`, {
            cookie: reader.cookie,
            body: { body: 'Лишний' },
          })
        ).statusCode,
      ).toBe(429);
      const detail = (await req('GET', `/api/posts/${id}`, { cookie: reader.cookie })).json();
      expect(detail.commentList.some((x: { body: string }) => x.body === 'Первый')).toBe(false);
      expect(detail.commentList[0]).not.toHaveProperty('authorId');

      expect(
        (
          await req('POST', '/api/favorites', {
            cookie: reader.cookie,
            body: { entityType: 'post', entityId: id },
          })
        ).json().saved,
      ).toBe(true);
      expect(
        (
          await req('GET', `/api/me/favorites/check?entityType=post&entityId=${id}`, {
            cookie: author.cookie,
          })
        ).json().saved,
      ).toBe(false);
      const favs = (await req('GET', '/api/me/favorites', { cookie: reader.cookie })).json();
      expect(favs[0]).toMatchObject({ entityType: 'post', available: true, href: `/feed/${id}` });
      expect((await req('DELETE', `/api/posts/${id}`, { cookie: author.cookie })).statusCode).toBe(
        200,
      );
      expect(
        (await req('GET', '/api/me/favorites', { cookie: reader.cookie })).json()[0].available,
      ).toBe(false);
    });
  });
  describe('messages and notifications (PHASE 7b)', () => {
    it('limits conversations to participants, honours blocks and keeps attachments private', async () => {
      const author = await user('p7b-author');
      const writer = await user('p7b-writer');
      const outsider = await user('p7b-out');
      const mod = await user('p7b-mod', 'moderator');

      const created = await req('POST', '/api/posts', {
        cookie: author.cookie,
        body: { body: 'Пост для проверки сообщений' },
      });
      const postId = created.json().id as string;
      await req('POST', `/api/moderation/posts/${postId}/approve`, {
        cookie: mod.cookie,
        body: {},
      });
      const notes = (await req('GET', '/api/me/notifications', { cookie: author.cookie })).json();
      expect(notes.items[0].type).toBe('post_approved');
      expect(notes.items[0].title).not.toContain('Пост для проверки');

      await req('POST', `/api/posts/${postId}/comments`, {
        cookie: writer.cookie,
        body: { body: 'Комментарий' },
      });
      expect(
        (await req('GET', '/api/me/unread', { cookie: author.cookie })).json().notifications,
      ).toBe(2);
      expect(
        (
          await req('POST', '/api/me/notifications/read', { cookie: author.cookie, body: {} })
        ).json().updated,
      ).toBe(2);

      expect(
        (await req('POST', '/api/conversations', { cookie: author.cookie, body: { postId } }))
          .statusCode,
      ).toBe(400);
      const start = await req('POST', '/api/conversations', {
        cookie: writer.cookie,
        body: { postId },
      });
      expect(start.statusCode).toBe(200);
      const convId = start.json().id as string;
      expect(
        (
          await req('POST', '/api/conversations', { cookie: writer.cookie, body: { postId } })
        ).json().id,
      ).toBe(convId);
      // Empty conversations are not listed for the recipient.
      expect(
        (await req('GET', '/api/me/conversations', { cookie: author.cookie })).json().items,
      ).toHaveLength(0);

      const send = (cookie: string, body: Record<string, unknown>) =>
        req('POST', `/api/conversations/${convId}/messages`, { cookie, body });
      const first = await send(writer.cookie, { body: 'Здравствуйте!', clientId: 'retry-key-001' });
      expect(first.statusCode).toBe(201);
      const retry = await send(writer.cookie, { body: 'Здравствуйте!', clientId: 'retry-key-001' });
      expect(retry.json().id).toBe(first.json().id);
      expect((await send(writer.cookie, { body: '' })).statusCode).toBe(400);

      for (const path of [`/api/conversations/${convId}`, `/api/conversations/${convId}/messages`])
        expect((await req('GET', path, { cookie: outsider.cookie })).statusCode).toBe(404);
      expect((await send(outsider.cookie, { body: 'чужой' })).statusCode).toBe(404);

      expect((await req('GET', '/api/me/unread', { cookie: author.cookie })).json().messages).toBe(
        1,
      );
      const list = (await req('GET', '/api/me/conversations', { cookie: author.cookie })).json();
      expect(list.items[0]).toMatchObject({ id: convId, unread: 1, other: { id: writer.id } });
      await req('POST', `/api/conversations/${convId}/read`, { cookie: author.cookie, body: {} });
      expect((await req('GET', '/api/me/unread', { cookie: author.cookie })).json().messages).toBe(
        0,
      );

      // Private attachments: only own private uploads, visible to the two members only.
      const pub = await req('POST', '/api/media', { cookie: writer.cookie, raw: PNG });
      expect(
        (await send(writer.cookie, { body: 'фото', mediaIds: [pub.json().id] })).statusCode,
      ).toBe(400);
      const priv = await req('POST', '/api/media?scope=private', {
        cookie: writer.cookie,
        raw: PNG,
      });
      const mediaId = priv.json().id as string;
      expect(
        (
          await req('POST', '/api/posts', {
            cookie: writer.cookie,
            body: { body: 'пост с личным фото', imageIds: [mediaId] },
          })
        ).statusCode,
      ).toBe(400);
      expect((await send(writer.cookie, { body: '', mediaIds: [mediaId] })).statusCode).toBe(201);
      expect((await req('GET', `/api/media/${mediaId}`)).statusCode).toBe(404);
      expect(
        (await req('GET', `/api/media/${mediaId}`, { cookie: outsider.cookie })).statusCode,
      ).toBe(404);
      const seen = await req('GET', `/api/media/${mediaId}`, { cookie: author.cookie });
      expect(seen.statusCode).toBe(200);
      expect(seen.headers['cache-control']).toBe('private, no-store');

      const history = (
        await req('GET', `/api/conversations/${convId}/messages`, { cookie: author.cookie })
      ).json();
      expect(history.items.map((m: { mine: boolean }) => m.mine)).toEqual([false, false]);
      expect(history.items[0].clientId).toBeUndefined();
      const newer = (
        await req('GET', `/api/conversations/${convId}/messages?after=${first.json().id}`, {
          cookie: author.cookie,
        })
      ).json();
      expect(newer.items).toHaveLength(1);

      // Only the recipient may report; the sender and outsiders get 404.
      const report = (cookie: string) =>
        req('POST', '/api/complaints', {
          cookie,
          body: { entityType: 'message', entityId: first.json().id, reason: 'spam' },
        });
      expect((await report(writer.cookie)).statusCode).toBe(404);
      expect((await report(outsider.cookie)).statusCode).toBe(404);
      expect((await report(author.cookie)).statusCode).toBe(201);

      // Blocks: partners only; a block stops sending both ways.
      expect(
        (await req('POST', `/api/users/${outsider.id}/block`, { cookie: author.cookie, body: {} }))
          .statusCode,
      ).toBe(404);
      expect(
        (await req('POST', `/api/users/${writer.id}/block`, { cookie: author.cookie, body: {} }))
          .statusCode,
      ).toBe(200);
      expect((await send(writer.cookie, { body: 'ещё' })).statusCode).toBe(403);
      expect((await send(author.cookie, { body: 'ответ' })).statusCode).toBe(403);
      expect(
        (await req('GET', `/api/conversations/${convId}`, { cookie: writer.cookie })).json(),
      ).toMatchObject({ canSend: false, blockedByMe: false });
      await req('DELETE', `/api/users/${writer.id}/block`, { cookie: author.cookie });
      expect((await send(author.cookie, { body: 'ответ' })).statusCode).toBe(201);

      // Delete: sender only, content erased.
      const msgId = first.json().id as string;
      expect(
        (await req('DELETE', `/api/messages/${msgId}`, { cookie: author.cookie })).statusCode,
      ).toBe(404);
      expect(
        (await req('DELETE', `/api/messages/${msgId}`, { cookie: writer.cookie })).statusCode,
      ).toBe(200);
      const row = await prisma.message.findUniqueOrThrow({ where: { id: msgId } });
      expect(row).toMatchObject({ status: 'deleted', body: '', mediaIds: [] });
      const audit = await prisma.auditLog.findMany({ where: { actorId: writer.id } });
      expect(JSON.stringify(audit)).not.toContain('Здравствуйте');
    });

    it('rate-limits message sending', async () => {
      const a = await user('p7b-rate-a');
      const b = await user('p7b-rate-b');
      const mod = await user('p7b-rate-mod', 'moderator');
      const postId = (
        await req('POST', '/api/posts', { cookie: a.cookie, body: { body: 'Пост для лимита' } })
      ).json().id;
      await req('POST', `/api/moderation/posts/${postId}/approve`, {
        cookie: mod.cookie,
        body: {},
      });
      const convId = (
        await req('POST', '/api/conversations', { cookie: b.cookie, body: { postId } })
      ).json().id;
      for (let i = 0; i < 20; i++)
        expect(
          (
            await req('POST', `/api/conversations/${convId}/messages`, {
              cookie: b.cookie,
              body: { body: `сообщение ${i}` },
            })
          ).statusCode,
        ).toBe(201);
      expect(
        (
          await req('POST', `/api/conversations/${convId}/messages`, {
            cookie: b.cookie,
            body: { body: 'лишнее' },
          })
        ).statusCode,
      ).toBe(429);
      const page = (
        await req('GET', `/api/conversations/${convId}/messages`, { cookie: a.cookie })
      ).json();
      expect(page.items).toHaveLength(20);
      expect(page.nextBefore).toBeNull();
    });
  });
  describe('global search and sitemap (PHASE 8a)', () => {
    it('searches only public content across modules, with paging, sort and suggestions', async () => {
      const owner = await user('p8-owner');
      const tag = `кварц${Date.now().toString(36)}`;
      const future = new Date(Date.now() + 7 * 86_400_000);
      const job = (slug: string, status: string, expiresAt = future) =>
        prisma.job.create({
          data: {
            slug,
            title: `Вакансия ${tag} ${slug}`,
            employer: 'Работодатель',
            description: 'Описание',
            status,
            authorId: owner.id,
            publishedAt: new Date(),
            expiresAt,
          },
        });
      await job(`${tag}-pub`, 'published');
      await job(`${tag}-pending`, 'pending');
      await job(`${tag}-old`, 'published', new Date(Date.now() - 86_400_000));
      const group = (slug: string, visibility: string) =>
        prisma.group.create({
          data: {
            slug,
            name: `Группа ${tag} ${slug}`,
            topic: 'other',
            visibility,
            status: 'active',
            createdById: owner.id,
          },
        });
      const open = await group(`${tag}-open`, 'open');
      const closed = await group(`${tag}-closed`, 'closed');
      for (const g of [open, closed, null])
        await prisma.post.create({
          data: {
            body: `Пост про ${tag} в ${g?.visibility ?? 'ленте'}`,
            authorId: owner.id,
            groupId: g?.id ?? null,
            status: 'published',
            publishedAt: new Date(),
          },
        });
      await prisma.post.create({
        data: { body: `Черновик ${tag}`, authorId: owner.id, status: 'pending' },
      });

      const all = (await req('GET', `/api/search?q=${encodeURIComponent(tag)}`)).json();
      const kinds = all.items.map((i: { type: string; title: string }) => `${i.type}:${i.title}`);
      expect(all.total).toBe(5);
      expect(kinds.filter((k: string) => k.startsWith('jobs:'))).toEqual([
        `jobs:Вакансия ${tag} ${tag}-pub`,
      ]);
      expect(kinds.filter((k: string) => k.startsWith('groups:'))).toHaveLength(2);
      const posts = all.items.filter((i: { type: string }) => i.type === 'posts');
      expect(posts.map((p: { snippet: string }) => p.snippet).sort()).toEqual(
        [`Пост про ${tag} в open`, `Пост про ${tag} в ленте`].sort(),
      );
      expect(JSON.stringify(all)).not.toContain('Черновик');

      const page2 = (
        await req('GET', `/api/search?q=${encodeURIComponent(tag)}&limit=4&page=2&sort=date`)
      ).json();
      expect(page2).toMatchObject({ total: 5, page: 2, limit: 4 });
      expect(page2.items).toHaveLength(1);
      expect(
        (await req('GET', `/api/search?q=${encodeURIComponent(tag)}&type=groups&category=x`)).json()
          .total,
      ).toBe(0);
      expect(
        (await req('GET', `/api/search?q=${encodeURIComponent(tag)}&type=secret`)).statusCode,
      ).toBe(400);

      const suggest = (await req('GET', `/api/search/suggest?q=${encodeURIComponent(tag)}`)).json()
        .items;
      expect(suggest.length).toBe(3);
      expect(suggest.every((s: { type: string }) => s.type !== 'posts')).toBe(true);

      const map = (await req('GET', '/api/sitemap')).json();
      const jobSlugs = map.jobs.map((j: { slug: string }) => j.slug);
      expect(jobSlugs).toContain(`${tag}-pub`);
      expect(jobSlugs).not.toContain(`${tag}-pending`);
      expect(jobSlugs).not.toContain(`${tag}-old`);
      const groupSlugs = map.groups.map((g: { slug: string }) => g.slug);
      expect(groupSlugs).toContain(`${tag}-open`);
      expect(groupSlugs).not.toContain(`${tag}-closed`);
    });
  });
  describe('notification center and analytics (PHASE 8b)', () => {
    it('filters by category, honours opt-outs for optional categories only', async () => {
      const author = await user('p8b-author');
      const other = await user('p8b-other');
      const mod = await user('p8b-mod', 'moderator');
      const settings = (
        await req('GET', '/api/me/notification-settings', { cookie: author.cookie })
      ).json();
      expect(settings.channels).toEqual({
        inApp: true,
        email: false,
        push: false,
        telegram: false,
      });
      const put = await req('PUT', '/api/me/notification-settings', {
        cookie: author.cookie,
        body: { categories: { comments: false, moderation: false } },
      });
      const cats = Object.fromEntries(
        put.json().categories.map((c: { key: string; enabled: boolean }) => [c.key, c.enabled]),
      );
      expect(cats).toMatchObject({ comments: false, moderation: true });

      const postId = (
        await req('POST', '/api/posts', { cookie: author.cookie, body: { body: 'Пост 8b' } })
      ).json().id as string;
      await req('POST', `/api/moderation/posts/${postId}/approve`, {
        cookie: mod.cookie,
        body: {},
      });
      await req('POST', `/api/posts/${postId}/comments`, {
        cookie: other.cookie,
        body: { body: 'Комментарий 8b' },
      });
      const list = (await req('GET', '/api/me/notifications', { cookie: author.cookie })).json();
      expect(list.items.map((n: { type: string }) => n.type)).toEqual(['post_approved']);
      expect(list.unread).toEqual({ moderation: 1 });
      const filtered = (
        await req('GET', '/api/me/notifications?category=groups', { cookie: author.cookie })
      ).json();
      expect(filtered.items).toHaveLength(0);
      expect(
        (await req('GET', '/api/me/notifications?category=nope', { cookie: author.cookie }))
          .statusCode,
      ).toBe(400);
      expect(
        (
          await req('POST', '/api/me/notifications/read', {
            cookie: author.cookie,
            body: { category: 'moderation' },
          })
        ).json().updated,
      ).toBe(1);
    });

    it('stores privacy-minimal events and exposes aggregates only to analytics staff', async () => {
      const resident = await user('p8b-res');
      const admin = await user('p8b-admin', 'admin');
      const marker = `/jobs/p8b-${Date.now().toString(36)}`;
      expect(
        (
          await req('POST', '/api/analytics/events', {
            body: {
              name: 'page_view',
              path: `${marker}?token=secret`,
              referrer: 'https://vk.com/wall1',
              utm: { source: 'VK', medium: 'social' },
            },
          })
        ).statusCode,
      ).toBe(204);
      expect(
        (await req('POST', '/api/analytics/events', { body: { name: 'registration', path: '/' } }))
          .statusCode,
      ).toBe(400);
      const view = await prisma.analyticsEvent.findFirstOrThrow({ where: { path: marker } });
      expect(view).toMatchObject({
        module: 'jobs',
        source: 'vk',
        medium: 'social',
        referrerHost: 'vk.com',
        actor: null,
      });
      expect(JSON.stringify(view)).not.toContain('secret');

      const before = new Date();
      await req('GET', `/api/search?q=${encodeURIComponent('+7 913 555-12-34')}`);
      const search = await prisma.analyticsEvent.findFirstOrThrow({
        where: { name: 'search', occurredAt: { gte: before } },
        orderBy: { occurredAt: 'desc' },
      });
      expect(search.query).toBeNull();
      expect(search.results).toBe(0);
      const reg = await prisma.analyticsEvent.count({
        where: { name: 'registration', occurredAt: { gte: new Date(Date.now() - 600_000) } },
      });
      expect(reg).toBeGreaterThan(0);
      const actors = await prisma.analyticsEvent.findMany({
        where: { actor: { not: null } },
        take: 5,
      });
      for (const a of actors) expect(a.actor).not.toBe(resident.id);

      expect(
        (await req('GET', '/api/admin/analytics', { cookie: resident.cookie })).statusCode,
      ).toBe(403);
      const summary = await req('GET', '/api/admin/analytics?days=7', { cookie: admin.cookie });
      expect(summary.statusCode).toBe(200);
      expect(summary.json()).toMatchObject({ timezone: 'Asia/Novosibirsk', days: 7 });
      expect(summary.json().totals.some((t: { name: string }) => t.name === 'page_view')).toBe(
        true,
      );
    });
  });
  describe('map, recommendations (PHASE 9)', () => {
    it('validates coordinate pairs, lists places and ranks explainable recommendations', async () => {
      const editor = await user('p9-editor', 'admin');
      const resident = await user('p9-res');
      const base = {
        kind: 'organization',
        name: 'Тестовая организация P9',
        description: 'Описание',
        address: 'ул. Тестовая, 1',
        status: 'published',
      };
      const half = await req('POST', '/api/staff/organizations', {
        cookie: editor.cookie,
        body: { ...base, latitude: 54.9 },
      });
      expect(half.statusCode).toBe(400);
      const far = await req('POST', '/api/staff/organizations', {
        cookie: editor.cookie,
        body: { ...base, latitude: 40, longitude: 83 },
      });
      expect(far.statusCode).toBe(400);
      const ok = await req('POST', '/api/staff/organizations', {
        cookie: editor.cookie,
        body: { ...base, latitude: 54.9, longitude: 83.1 },
      });
      expect(ok.statusCode).toBe(201);
      const map = (await req('GET', '/api/map')).json();
      const place = map.places.find((x: { title: string }) => x.title === base.name);
      expect(place).toMatchObject({ type: 'organization', latitude: 54.9, longitude: 83.1 });
      expect(map.provider).toBeNull();

      expect((await req('GET', '/api/me/recommendations')).statusCode).toBe(401);
      const cat = await prisma.category.create({
        data: { module: 'news', slug: `p9-${Date.now().toString(36)}`, name: 'Категория P9' },
      });
      const news = await prisma.newsArticle.create({
        data: {
          slug: `p9-news-${Date.now().toString(36)}`,
          title: 'Новость P9',
          body: 'Текст',
          status: 'published',
          publishedAt: new Date(),
          categoryId: cat.id,
        },
      });
      const set = await req('PUT', '/api/me/interests', {
        cookie: resident.cookie,
        body: { categoryIds: [cat.id, '00000000-0000-7000-8000-000000000000'] },
      });
      expect(set.json().categories.filter((c: { selected: boolean }) => c.selected)).toHaveLength(
        1,
      );
      const recos = (
        await req('GET', '/api/me/recommendations', { cookie: resident.cookie })
      ).json();
      const hit = recos.items.find((r: { id: string }) => r.id === news.id);
      expect(hit.reasons[0]).toContain(cat.name);
      expect(
        (
          await req('POST', '/api/me/recommendations/hidden', {
            cookie: resident.cookie,
            body: { entityType: 'news', entityId: news.id },
          })
        ).statusCode,
      ).toBe(200);
      const after = (
        await req('GET', '/api/me/recommendations', { cookie: resident.cookie })
      ).json();
      expect(after.items.some((r: { id: string }) => r.id === news.id)).toBe(false);
      expect(after.hidden).toBe(1);
    });
  });

  describe('PHASE 11: feature flags and integrations', () => {
    it('lets admins switch modules off, refuses unconfigured integrations and never fakes AI', async () => {
      const admin = await user('p11-admin', 'admin');
      const resident = await user('p11-resident');
      expect((await req('GET', '/api/features')).json()).toMatchObject({
        groups: true,
        ai_assistant: false,
      });
      expect(
        (await req('GET', '/api/admin/integrations', { cookie: resident.cookie })).statusCode,
      ).toBe(403);
      expect(
        (
          await req('PATCH', '/api/admin/features/groups', {
            cookie: resident.cookie,
            body: { enabled: false },
          })
        ).statusCode,
      ).toBe(403);
      const ai = await req('PATCH', '/api/admin/features/ai_assistant', {
        cookie: admin.cookie,
        body: { enabled: true },
      });
      expect(ai.statusCode).toBe(409);
      expect(ai.json().code).toBe('NOT_CONFIGURED');
      const ask = await req('POST', '/api/assistant/ask', { body: { question: 'Где аптека?' } });
      expect(ask.statusCode).toBe(503);
      expect(ask.json().code).toBe('NOT_CONFIGURED');
      try {
        const off = await req('PATCH', '/api/admin/features/groups', {
          cookie: admin.cookie,
          body: { enabled: false },
        });
        expect(off.statusCode).toBe(200);
        expect((await req('GET', '/api/features')).json().groups).toBe(false);
        const blocked = await req('GET', '/api/groups');
        expect(blocked.statusCode).toBe(404);
        expect(blocked.json().code).toBe('FEATURE_DISABLED');
        expect(
          (await req('GET', '/api/me/conversations', { cookie: resident.cookie })).statusCode,
        ).toBe(200);
        expect(
          await prisma.auditLog.count({ where: { action: 'feature.updated', actorId: admin.id } }),
        ).toBe(1);
      } finally {
        await req('PATCH', '/api/admin/features/groups', {
          cookie: admin.cookie,
          body: { enabled: true },
        });
      }
      expect((await req('GET', '/api/groups')).statusCode).toBe(200);
    });
  });

  describe('PHASE 12: territories', () => {
    it('exposes only the active default locality publicly and the full tree to admins', async () => {
      const pub = (await req('GET', '/api/territories')).json();
      expect(pub.current.slug).toBe('oktyabrsky-svetly');
      expect(pub.current.path.map((p: { slug: string }) => p.slug)).toEqual([
        'novosibirsk-oblast',
        'moshkovsky-rayon',
      ]);
      expect(pub.available).toHaveLength(1);
      const resident = await user('p12-resident');
      expect(
        (await req('GET', '/api/admin/territories', { cookie: resident.cookie })).statusCode,
      ).toBe(403);
      const admin = await user('p12-admin', 'admin');
      const all = (await req('GET', '/api/admin/territories', { cookie: admin.cookie })).json();
      expect(all.items).toHaveLength(3);
      await expect(
        prisma.territory.update({ where: { slug: 'moshkovsky-rayon' }, data: { isDefault: true } }),
      ).rejects.toThrow();
    });
  });
});
