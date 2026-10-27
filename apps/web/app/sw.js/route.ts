import { readFileSync } from 'node:fs';
import path from 'node:path';
import { serviceWorkerSource } from '../../lib/pwa';

export const dynamic = 'force-dynamic';

const BOOT = `boot-${Date.now()}`;

function buildId(): string {
  for (const dir of [process.cwd(), path.join(process.cwd(), 'apps/web')]) {
    try {
      return readFileSync(path.join(dir, '.next/BUILD_ID'), 'utf8').trim();
    } catch {
      // try next location
    }
  }
  return BOOT;
}

export function GET() {
  return new Response(serviceWorkerSource(buildId()), {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': 'no-cache, no-store, must-revalidate',
      'service-worker-allowed': '/',
    },
  });
}
