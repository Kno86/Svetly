import { describe, expect, it, vi } from 'vitest';
import { cacheable, serviceWorkerSource } from './pwa';

const O = 'https://svetly.example';

type Handler = (e: Record<string, unknown>) => void;
function boot(version: string, keys: string[]) {
  const handlers: Record<string, Handler> = {};
  const store = new Set(keys);
  const caches = {
    keys: async () => [...store],
    delete: vi.fn(async (k: string) => store.delete(k)),
    open: async (k: string) => {
      store.add(k);
      return { addAll: async () => undefined, put: async () => undefined };
    },
    match: async () => undefined,
  };
  const self = {
    addEventListener: (t: string, h: Handler) => (handlers[t] = h),
    skipWaiting: vi.fn(),
    clients: { claim: async () => undefined },
    location: { origin: O },
  };
  new Function('self', 'caches', 'fetch', 'Response', serviceWorkerSource(version))(
    self,
    caches,
    vi.fn(async () => new Response('ok')),
    Response,
  );
  const run = async (type: string, extra: Record<string, unknown> = {}) => {
    let wait: Promise<unknown> | undefined;
    let responded = false;
    handlers[type]!({
      ...extra,
      waitUntil: (p: Promise<unknown>) => (wait = p),
      respondWith: () => (responded = true),
    });
    await wait;
    return responded;
  };
  return { run, store, self };
}

describe('service worker policy', () => {
  it('caches only static assets of the same origin', () => {
    expect(cacheable(`${O}/_next/static/chunks/a.js`, O)).toBe(true);
    expect(cacheable(`${O}/brand/icon-192.png`, O)).toBe(true);
    for (const p of [
      '/api/me',
      '/account',
      '/messages',
      '/admin',
      '/notifications',
      '/',
      '/news/x',
    ])
      expect(cacheable(`${O}${p}`, O)).toBe(false);
    expect(cacheable(`${O}/_next/static/a.js?token=1`, O)).toBe(false);
    expect(cacheable(`https://cdn.example/_next/static/a.js`, O)).toBe(false);
  });

  it('drops caches of old versions on activate and everything on sign-out', async () => {
    const sw = boot('v2', ['svetly-static-v1', 'svetly-static-v2']);
    await sw.run('activate');
    expect([...sw.store]).toEqual(['svetly-static-v2']);
    await sw.run('message', { data: { type: 'CLEAR' } });
    expect(sw.store.size).toBe(0);
    await sw.run('message', { data: { type: 'SKIP_WAITING' } });
    expect(sw.self.skipWaiting).toHaveBeenCalled();
  });

  it('never intercepts API or non-GET requests', async () => {
    const sw = boot('v1', []);
    const req = (url: string, method = 'GET', mode = 'cors') => ({
      request: { url, method, mode },
    });
    expect(await sw.run('fetch', req(`${O}/api/me`))).toBe(false);
    expect(await sw.run('fetch', req(`${O}/_next/static/a.js`, 'POST'))).toBe(false);
    expect(await sw.run('fetch', req(`${O}/_next/static/a.js`))).toBe(true);
    expect(await sw.run('fetch', req(`${O}/account`, 'GET', 'navigate'))).toBe(true);
  });
});
