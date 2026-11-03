/** Server-side reads from the internal API. Errors are surfaced to the page (never replaced with fake content). */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number };

export interface CategoryRef {
  slug: string;
  name: string;
}
export interface Category extends CategoryRef {
  id: string;
  module: string;
}
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

const base = () => process.env.API_INTERNAL_URL ?? 'http://api:4000';

export async function apiGet<T>(
  path: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ApiResult<T>> {
  try {
    const res = await fetchImpl(`${base()}${path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: 0 };
  }
}

export function query(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}

type SearchParams = Record<string, string | string[] | undefined>;
export function param(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v)?.slice(0, 200) || undefined;
}
export function pageParam(sp: SearchParams): number {
  const n = Number(param(sp, 'page'));
  return Number.isInteger(n) && n > 0 && n <= 1000 ? n : 1;
}

const TZ = 'Asia/Novosibirsk';
export function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(value));
}

export function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) return 'Цена не указана';
  if (price === 0) return 'Бесплатно';
  return `${new Intl.NumberFormat('ru-RU').format(price)} ₽`;
}

export function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Event timing relative to `now`; kept out of render so components stay pure. */
export function eventPhase(startsAt: string, endsAt: string | null, now: number = Date.now()) {
  return {
    started: new Date(startsAt).getTime() <= now,
    ended: new Date(endsAt ?? startsAt).getTime() < now,
  };
}

/** Day, short month and time in the territory's zone, for calendar-style date boxes. */
export function dateParts(value: string): { day: string; month: string; time: string } {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return {
    day: get('day'),
    month: get('month').replace('.', ''),
    time: `${get('hour')}:${get('minute')}`,
  };
}
