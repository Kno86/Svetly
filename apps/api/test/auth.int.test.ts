import 'reflect-metadata';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.factory.js';
import { MailerService, type MailMessage } from '../src/auth/mailer.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'correct-horse-42';

describe('auth, RBAC and audit against a real PostgreSQL database', () => {
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
      'x-forwarded-for': `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
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

  function linkFrom(to: string): string {
    const msg = [...mail].reverse().find((m) => m.to === to);
    const match = msg?.text.match(/https?:\/\/\S+/);
    if (!match) throw new Error(`no link mailed to ${to}`);
    return match[0];
  }

  async function signUp(address: string) {
    const res = await req('POST', '/api/auth/sign-up/email', {
      body: { name: 'Тест', email: address, password: PASSWORD },
    });
    expect(res.statusCode).toBe(200);
  }

  async function verify(address: string) {
    const url = new URL(linkFrom(address));
    const res = await req('GET', url.pathname + url.search);
    expect([200, 302]).toContain(res.statusCode);
  }

  async function signIn(address: string, password = PASSWORD) {
    const res = await req('POST', '/api/auth/sign-in/email', {
      body: { email: address, password },
    });
    const cookie = [res.headers['set-cookie']]
      .flat()
      .filter(Boolean)
      .map((c) => String(c).split(';')[0])
      .join('; ');
    return { res, cookie };
  }

  async function verifiedUser(name: string, role?: string) {
    const address = email(name);
    await signUp(address);
    await verify(address);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: address } });
    if (role) await prisma.userRole.create({ data: { userId: user.id, roleCode: role } });
    const { cookie } = await signIn(address);
    return { id: user.id, address, cookie };
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

  it('registers, requires email verification, then signs in with a session cookie', async () => {
    const address = email('flow');
    await signUp(address);
    const account = await prisma.account.findFirstOrThrow({ where: { user: { email: address } } });
    expect(account.password).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);

    const before = await signIn(address);
    expect(before.res.statusCode).toBe(403);

    await verify(address);
    const after = await signIn(address);
    expect(after.res.statusCode).toBe(200);
    expect(String(after.res.headers['set-cookie'])).toMatch(/svetly\.session_token=.*HttpOnly/i);

    const me = await req('GET', '/api/me', { cookie: after.cookie });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({
      user: { email: address, emailVerified: true },
      roles: [],
      permissions: [],
    });
  });

  it('rejects wrong passwords and records failures in the audit log', async () => {
    const { address } = await verifiedUser('wrongpw');
    const { res } = await signIn(address, 'not-the-password');
    expect(res.statusCode).toBe(401);
    const entry = await prisma.auditLog.findFirst({
      where: { action: 'auth.sign_in', outcome: 'failure' },
      orderBy: { occurredAt: 'desc' },
    });
    expect(entry?.metadata).toMatchObject({ status: 'UNAUTHORIZED' });
    expect(JSON.stringify(entry)).not.toContain('not-the-password');
    expect(JSON.stringify(entry)).not.toContain(address);
  });

  it('resets the password via emailed link and revokes existing sessions', async () => {
    const { address, cookie } = await verifiedUser('reset');
    const r = await req('POST', '/api/auth/request-password-reset', {
      body: { email: address, redirectTo: '/reset-password' },
    });
    expect(r.statusCode).toBe(200);
    const token = new URL(linkFrom(address)).pathname.split('/').pop();
    const reset = await req('POST', '/api/auth/reset-password', {
      body: { token, newPassword: 'brand-new-pass-7' },
    });
    expect(reset.statusCode).toBe(200);
    expect((await req('GET', '/api/me', { cookie })).statusCode).toBe(401);
    expect((await signIn(address)).res.statusCode).toBe(401);
    expect((await signIn(address, 'brand-new-pass-7')).res.statusCode).toBe(200);
  });

  it('lists and revokes own sessions', async () => {
    const { address, cookie } = await verifiedUser('sessions');
    const second = await signIn(address);
    const list = await req('GET', '/api/auth/list-sessions', { cookie });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(2);
    const revoke = await req('POST', '/api/auth/revoke-other-sessions', { cookie, body: {} });
    expect(revoke.statusCode).toBe(200);
    expect((await req('GET', '/api/me', { cookie: second.cookie })).statusCode).toBe(401);
    expect((await req('GET', '/api/me', { cookie })).statusCode).toBe(200);
  });

  it('rejects auth requests from a foreign origin', async () => {
    const res = await req('POST', '/api/auth/sign-in/email', {
      origin: 'https://evil.example',
      body: { email: email('x'), password: PASSWORD },
    });
    expect(res.statusCode).toBe(403);
  });

  describe('permission matrix', () => {
    const endpoints: {
      method: 'GET' | 'POST';
      url: (id: string) => string;
      permission: string;
      body?: unknown;
    }[] = [
      { method: 'GET', url: () => '/api/admin/users', permission: 'users.read' },
      { method: 'GET', url: () => '/api/admin/roles', permission: 'roles.read' },
      { method: 'GET', url: () => '/api/admin/audit-log', permission: 'audit.read' },
      {
        method: 'POST',
        url: (id) => `/api/admin/users/${id}/roles`,
        permission: 'roles.assign',
        body: { role: 'support' },
      },
      { method: 'POST', url: (id) => `/api/admin/users/${id}/block`, permission: 'users.block' },
      {
        method: 'POST',
        url: (id) => `/api/admin/users/${id}/sessions/revoke`,
        permission: 'users.sessions.revoke',
      },
    ];
    const grants: Record<string, string[]> = {
      user: [],
      support: ['users.read'],
      moderator: ['users.read'],
      editor: [],
      admin: [
        'users.read',
        'users.block',
        'users.sessions.revoke',
        'roles.read',
        'roles.assign',
        'audit.read',
      ],
    };

    it('anonymous requests get 401 on every staff endpoint', async () => {
      const target = await verifiedUser('anon-target');
      for (const e of endpoints) {
        const res = await req(e.method, e.url(target.id), { body: e.body });
        expect(res.statusCode, `${e.method} ${e.url(target.id)}`).toBe(401);
      }
    });

    for (const [role, allowed] of Object.entries(grants)) {
      it(`${role}: allowed only on endpoints matching its permissions`, async () => {
        const actor = await verifiedUser(`actor-${role}`, role === 'user' ? undefined : role);
        for (const e of endpoints) {
          const target = await verifiedUser(`target-${role}-${e.permission}`);
          const res = await req(e.method, e.url(target.id), { cookie: actor.cookie, body: e.body });
          const expected = allowed.includes(e.permission) ? [200, 204] : [403];
          expect(
            expected,
            `${role} ${e.method} ${e.url(target.id)} -> ${res.statusCode}`,
          ).toContain(res.statusCode);
        }
      });
    }
  });

  it('admin cannot grant admin/super_admin or act on an equal-rank user; denials are audited', async () => {
    const admin = await verifiedUser('rank-admin', 'admin');
    const other = await verifiedUser('rank-admin2', 'admin');
    const plain = await verifiedUser('rank-plain');
    expect(
      (
        await req('POST', `/api/admin/users/${plain.id}/roles`, {
          cookie: admin.cookie,
          body: { role: 'admin' },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await req('POST', `/api/admin/users/${plain.id}/roles`, {
          cookie: admin.cookie,
          body: { role: 'super_admin' },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await req('POST', `/api/admin/users/${other.id}/block`, { cookie: admin.cookie }))
        .statusCode,
    ).toBe(403);
    expect(
      (await req('POST', `/api/admin/users/${admin.id}/block`, { cookie: admin.cookie }))
        .statusCode,
    ).toBe(403);
    const denied = await prisma.auditLog.count({ where: { actorId: admin.id, outcome: 'denied' } });
    expect(denied).toBeGreaterThanOrEqual(4);
  });

  it('staff mutations require a same-origin request (CSRF)', async () => {
    const admin = await verifiedUser('csrf-admin', 'admin');
    const plain = await verifiedUser('csrf-plain');
    const res = await req('POST', `/api/admin/users/${plain.id}/block`, {
      cookie: admin.cookie,
      origin: 'https://evil.example',
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: 'CSRF_ORIGIN_MISMATCH' });
  });

  it('blocking revokes sessions and prevents sign-in', async () => {
    const admin = await verifiedUser('block-admin', 'admin');
    const victim = await verifiedUser('block-victim');
    expect(
      (await req('POST', `/api/admin/users/${victim.id}/block`, { cookie: admin.cookie }))
        .statusCode,
    ).toBe(204);
    expect((await req('GET', '/api/me', { cookie: victim.cookie })).statusCode).toBe(401);
    expect((await signIn(victim.address)).res.statusCode).toBe(403);
    expect(
      (await req('POST', `/api/admin/users/${victim.id}/unblock`, { cookie: admin.cookie }))
        .statusCode,
    ).toBe(204);
    expect((await signIn(victim.address)).res.statusCode).toBe(200);
  });

  it('rate-limits repeated sign-in attempts from one address', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        headers: {
          origin: ORIGIN,
          'content-type': 'application/json',
          'x-forwarded-for': `192.0.2.${run.length}`,
        },
        payload: JSON.stringify({ email: email('ratelimit'), password: 'whatever-123' }),
      });
      statuses.push(res.statusCode);
    }
    expect(statuses).toContain(429);
  });

  it('audit log rejects UPDATE, DELETE and TRUNCATE at the database level', async () => {
    const entry = await prisma.auditLog.findFirstOrThrow();
    await expect(
      prisma.auditLog.update({ where: { id: entry.id }, data: { action: 'tampered' } }),
    ).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow(
      /append-only/,
    );
    await expect(prisma.$executeRawUnsafe('TRUNCATE audit_log')).rejects.toThrow(/append-only/);
  });

  it('database roles and permissions match src/rbac/permissions.ts', async () => {
    const { ROLES, PERMISSIONS } = await import('../src/rbac/permissions.js');
    const perms = await prisma.permission.findMany({ orderBy: { code: 'asc' } });
    expect(perms.map((p) => p.code)).toEqual(Object.keys(PERMISSIONS).sort());
    const roles = await prisma.role.findMany({ include: { permissions: true } });
    expect(
      Object.fromEntries(
        roles.map((r) => [r.code, r.permissions.map((p) => p.permissionCode).sort()]),
      ),
    ).toEqual(
      Object.fromEntries(Object.entries(ROLES).map(([c, r]) => [c, [...r.permissions].sort()])),
    );
  });
});
