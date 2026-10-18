import 'reflect-metadata';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.factory.js';
import { InstanceService } from '../src/instance/instance.service.js';

describe('API against a real PostgreSQL database', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createApp('warn');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/health/live returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health/live' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('GET /api/health/ready reports database and migrations as ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: 'ok',
      checks: { database: 'ok', migrations: 'ok' },
      pendingMigrations: [],
    });
  });

  it('GET /api/version returns service metadata', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/version' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ service: 'svetly-api', version: '0.1.0' });
  });

  it('propagates a valid x-request-id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health/live',
      headers: { 'x-request-id': 'test-req-1' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('creates the instance record once and never overwrites it', async () => {
    const instances = app.get(InstanceService);
    const first = await instances.ensureInstance();
    const second = await instances.ensureInstance();
    expect(second).toEqual(first);
    expect(first.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('returns 404 for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/does-not-exist' });
    expect(res.statusCode).toBe(404);
  });
});
