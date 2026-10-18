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
    });
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
