import type { Metadata } from 'next';
import { Badge, EmptyState } from '../../components/ui/Feedback';
import { Select, TextField } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { ItemCard, LoadError, PageHead, styles } from '../../components/content/Blocks';
import { apiGet, formatDate, param, query } from '../../lib/content';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Поиск', robots: { index: false } };

interface Hit {
  type: 'news' | 'announcements' | 'organizations' | 'events' | 'directory';
  slug: string;
  title: string;
  snippet: string;
  date: string | null;
}

export const TYPES: Record<Hit['type'], { label: string; href: (slug: string) => string }> = {
  news: { label: 'Новость', href: (s) => `/news/${s}` },
  announcements: { label: 'Объявление', href: (s) => `/announcements/${s}` },
  organizations: { label: 'Организация', href: (s) => `/organizations/${s}` },
  events: { label: 'Событие', href: (s) => `/events/${s}` },
  directory: { label: 'Справочник', href: (s) => `/directory#${s}` },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = param(sp, 'q') ?? '';
  const rawType = param(sp, 'type');
  const type = rawType && rawType in TYPES ? rawType : undefined;
  const res =
    q.length >= 2
      ? await apiGet<{ items: Hit[] }>(`/api/search${query({ q, type, limit: 50 })}`)
      : null;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Поиск"
        description="По новостям, объявлениям, организациям, событиям и справочнику."
        crumbs={[{ label: 'Поиск' }]}
      />
      <form method="get" action="/search" className={styles.filters} role="search">
        <TextField
          label="Что ищем"
          name="q"
          type="search"
          defaultValue={q}
          minLength={2}
          required
        />
        <Select label="Раздел" name="type" defaultValue={type ?? ''}>
          <option value="">Все разделы</option>
          {Object.entries(TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
        <Button type="submit">Найти</Button>
      </form>
      {res === null ? (
        <EmptyState
          title="Введите запрос"
          description="Минимум два символа. Ищем с учётом русской морфологии и опечаток."
        />
      ) : !res.ok ? (
        <LoadError />
      ) : res.data.items.length === 0 ? (
        <EmptyState
          title="Ничего не найдено"
          description="Попробуйте другую формулировку или уберите фильтр раздела."
        />
      ) : (
        <>
          <p aria-live="polite">Найдено: {res.data.items.length}</p>
          <div className={styles.list}>
            {res.data.items.map((h) => (
              <ItemCard
                key={`${h.type}-${h.slug}`}
                href={TYPES[h.type].href(h.slug)}
                title={h.title}
                badges={<Badge>{TYPES[h.type].label}</Badge>}
                meta={h.date && <time dateTime={h.date}>{formatDate(h.date)}</time>}
              >
                {h.snippet && <p className={styles.excerpt}>{h.snippet}</p>}
              </ItemCard>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
