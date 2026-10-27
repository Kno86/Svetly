/**
 * Service worker policy. Only versioned static assets and the offline page are cached;
 * HTML pages, API responses and anything private are always fetched from the network.
 */
export function cacheable(href: string, origin: string): boolean {
  const url = new URL(href);
  if (url.origin !== origin || url.search) return false;
  const p = url.pathname;
  return (
    p.startsWith('/_next/static/') ||
    p.startsWith('/brand/') ||
    p === '/favicon.ico' ||
    p === '/icon.svg' ||
    p === '/apple-icon.png'
  );
}

export const OFFLINE_URL = '/offline';
export const PRECACHE = [OFFLINE_URL, '/brand/icon-192.png', '/brand/svetly-logo.svg'];

/** Source of `/sw.js`; a new build id gives a new cache name and triggers the update flow. */
export function serviceWorkerSource(version: string): string {
  return `'use strict';
const VERSION = ${JSON.stringify(version)};
const CACHE = 'svetly-static-' + VERSION;
const OFFLINE_URL = ${JSON.stringify(OFFLINE_URL)};
const PRECACHE = ${JSON.stringify(PRECACHE)};
const cacheable = ${cacheable.toString()};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  if (type === 'SKIP_WAITING') self.skipWaiting();
  if (type === 'CLEAR')
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL).then((r) => r || Response.error())),
    );
    return;
  }
  if (!cacheable(req.url, self.location.origin)) return;
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
`;
}

/** Called on sign-out: drops every cache the service worker may hold. */
export async function clearOfflineData(): Promise<void> {
  if (typeof window === 'undefined') return;
  navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR' });
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
}
