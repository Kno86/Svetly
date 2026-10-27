#!/usr/bin/env node
// Basic load test for public read endpoints (PHASE 13). No dependencies; Node 24+.
// Usage: node infra/scripts/loadtest.mjs [baseUrl] [concurrency] [seconds]
// Run only against your own local or staging instance, never against a third-party host.
const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const concurrency = Number(process.argv[3] ?? 20);
const seconds = Number(process.argv[4] ?? 20);
const paths = [
  '/api/health/live',
  '/api/news',
  '/api/announcements',
  '/api/events',
  '/api/organizations',
  '/api/search?q=%D0%B2%D0%BE%D0%B4%D0%B0',
  '/',
  '/news',
];

const stats = new Map(paths.map((p) => [p, { ms: [], errors: 0, statuses: {} }]));
const deadline = Date.now() + seconds * 1000;
let i = 0;

async function worker() {
  while (Date.now() < deadline) {
    const path = paths[i++ % paths.length];
    const s = stats.get(path);
    const t = performance.now();
    try {
      const r = await fetch(base + path, { headers: { 'user-agent': 'svetly-loadtest' } });
      await r.arrayBuffer();
      s.statuses[r.status] = (s.statuses[r.status] ?? 0) + 1;
      if (r.status >= 500) s.errors++;
    } catch {
      s.errors++;
    }
    s.ms.push(performance.now() - t);
  }
}

const pct = (a, q) => a[Math.min(a.length - 1, Math.floor(q * a.length))] ?? 0;
await Promise.all(Array.from({ length: concurrency }, worker));
let total = 0;
let errors = 0;
console.log(`base=${base} concurrency=${concurrency} duration=${seconds}s`);
for (const [path, s] of stats) {
  s.ms.sort((a, b) => a - b);
  total += s.ms.length;
  errors += s.errors;
  console.log(
    `${path.padEnd(44)} n=${String(s.ms.length).padStart(6)} p50=${pct(s.ms, 0.5).toFixed(1)}ms p95=${pct(s.ms, 0.95).toFixed(1)}ms p99=${pct(s.ms, 0.99).toFixed(1)}ms errors=${s.errors} ${JSON.stringify(s.statuses)}`,
  );
}
console.log(`total=${total} rps=${(total / seconds).toFixed(1)} errors=${errors}`);
process.exitCode = errors > 0 ? 1 : 0;
