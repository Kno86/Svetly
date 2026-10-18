import { describe, expect, it } from 'vitest';
import { fetchApiStatus } from './api-status';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('fetchApiStatus', () => {
  it('reports ready with version info', async () => {
    const calls: string[] = [];
    const fakeFetch = (async (url: string) => {
      calls.push(url);
      return url.endsWith('/api/health/ready')
        ? jsonResponse({ status: 'ok' })
        : jsonResponse({ version: '0.1.0', builtAt: '2026-10-18T00:00:00Z' });
    }) as typeof fetch;
    expect(await fetchApiStatus('http://api:4000', fakeFetch)).toEqual({
      state: 'ready',
      version: '0.1.0',
      builtAt: '2026-10-18T00:00:00Z',
    });
    expect(calls).toEqual(['http://api:4000/api/health/ready', 'http://api:4000/api/version']);
  });

  it('reports not-ready when readiness fails', async () => {
    const fakeFetch = (async () => jsonResponse({ status: 'error' }, 503)) as typeof fetch;
    expect(await fetchApiStatus('http://api:4000', fakeFetch)).toEqual({
      state: 'not-ready',
      httpStatus: 503,
    });
  });

  it('reports unreachable on network errors', async () => {
    const fakeFetch = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    expect(await fetchApiStatus('http://api:4000', fakeFetch)).toEqual({ state: 'unreachable' });
  });
});
