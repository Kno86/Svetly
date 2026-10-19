import { describe, expect, it } from 'vitest';
import { loadConfig } from './env.js';

const url = 'postgresql://svetly:secret@db:5432/svetly';

describe('loadConfig', () => {
  it('uses local defaults', () => {
    expect(loadConfig({ DATABASE_URL: url })).toEqual({
      environment: 'local',
      databaseUrl: url,
      port: 4000,
      logLevel: 'info',
      publicUrl: 'http://localhost:3000',
      authSecret: undefined,
      authSecretFile: '/var/lib/svetly/auth-secret',
      mediaDir: '/var/lib/svetly/media',
      smtpUrl: undefined,
      mailFrom: 'SVETLY <no-reply@svetly.local>',
    });
  });

  const prod = {
    DATABASE_URL: url,
    SVETLY_ENV: 'production',
    SVETLY_PUBLIC_URL: 'https://svetly.example',
    BETTER_AUTH_SECRET: 'x'.repeat(40),
  };

  it('accepts a complete production configuration', () => {
    expect(loadConfig(prod).publicUrl).toBe('https://svetly.example');
  });

  it('requires a strong auth secret in production', () => {
    expect(() => loadConfig({ ...prod, BETTER_AUTH_SECRET: '' })).toThrow('BETTER_AUTH_SECRET');
    expect(() => loadConfig({ ...prod, BETTER_AUTH_SECRET: 'short' })).toThrow(
      'BETTER_AUTH_SECRET',
    );
  });

  it('requires https public URL in production', () => {
    expect(() => loadConfig({ ...prod, SVETLY_PUBLIC_URL: 'http://svetly.example' })).toThrow(
      'https',
    );
  });

  it('requires DATABASE_URL', () => {
    expect(() => loadConfig({})).toThrow('DATABASE_URL is required');
  });

  it('rejects unknown environments', () => {
    expect(() => loadConfig({ DATABASE_URL: url, SVETLY_ENV: 'staging' })).toThrow('SVETLY_ENV');
  });

  it('refuses development credentials in production', () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: 'postgresql://svetly:svetly_local_dev_only@db:5432/svetly',
        SVETLY_ENV: 'production',
        SVETLY_PUBLIC_URL: 'https://svetly.example',
        BETTER_AUTH_SECRET: 'x'.repeat(40),
      }),
    ).toThrow('Refusing to start in production');
  });

  it('allows development credentials locally', () => {
    expect(
      loadConfig({ DATABASE_URL: 'postgresql://svetly:svetly_local_dev_only@db:5432/svetly' })
        .environment,
    ).toBe('local');
  });

  it('validates API_PORT', () => {
    expect(() => loadConfig({ DATABASE_URL: url, API_PORT: 'abc' })).toThrow('API_PORT');
  });
});
