import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, errorMessage } from './auth-client';

afterEach(() => vi.unstubAllGlobals());

describe('auth client', () => {
  it('returns parsed data on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"user":{"id":"1"}}', { status: 200 })),
    );
    expect(await apiRequest('/api/me')).toEqual({
      ok: true,
      status: 200,
      data: { user: { id: '1' } },
      code: undefined,
    });
  });

  it('extracts error codes and never throws on network errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"code":"INVALID_EMAIL_OR_PASSWORD"}', { status: 401 })),
    );
    const failed = await apiRequest('/api/auth/sign-in/email', { body: {} });
    expect(failed).toMatchObject({ ok: false, status: 401, code: 'INVALID_EMAIL_OR_PASSWORD' });
    expect(errorMessage(failed)).toBe('Неверный email или пароль.');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    );
    expect(errorMessage(await apiRequest('/api/me'))).toContain('Нет связи');
  });

  it('maps rate limiting to a readable message', () => {
    expect(errorMessage({ ok: false, status: 429 })).toContain('Слишком много попыток');
  });
});
