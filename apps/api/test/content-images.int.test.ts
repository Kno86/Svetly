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

describe('content photos', () => {
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
      'x-forwarded-for': `10.7.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
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

  it('attaches photos to staff content and checks who may attach what', async () => {
    const editor = await user('pheditor', 'editor');
    const resident = await user('phres');
    const upload = async (cookie: string, scope = '') =>
      (await req('POST', `/api/media${scope}`, { cookie, raw: PNG })).json<{ id: string }>().id;
    const mine = await upload(editor.cookie);
    const theirs = await upload(resident.cookie);
    const hidden = await upload(resident.cookie, '?scope=private');

    const org = {
      name: `Фото-тест ${run}`,
      description: 'Карточка для проверки фотографий.',
      status: 'published',
    };
    const bad = await req('POST', '/api/staff/organizations', {
      cookie: editor.cookie,
      body: { ...org, imageIds: [hidden] },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().code).toBe('INVALID_MEDIA');

    const created = await req('POST', '/api/staff/organizations', {
      cookie: editor.cookie,
      body: { ...org, imageIds: [theirs, mine] },
    });
    expect(created.statusCode).toBe(201);
    const { id, slug } = created.json<{ id: string; slug: string }>();
    const page = await req('GET', `/api/organizations/${slug}`);
    expect(page.json().imageIds).toEqual([theirs, mine]);

    const job = await req('POST', '/api/jobs', {
      cookie: resident.cookie,
      body: {
        title: 'Помощник',
        employer: 'Частное лицо',
        description: 'Описание вакансии для теста фотографий.',
        imageIds: [mine],
      },
    });
    expect(job.statusCode).toBe(400);
    expect(job.json().code).toBe('INVALID_MEDIA');

    await prisma.organization.delete({ where: { id } });
    await prisma.mediaAsset.deleteMany({ where: { id: { in: [mine, theirs, hidden] } } });
  });
});
