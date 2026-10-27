import type { Metadata } from 'next';
import { Badge, EmptyState } from '../../components/ui/Feedback';
import { Select } from '../../components/ui/Field';
import { SearchField } from '../../components/search/SearchField';
import { Button } from '../../components/ui/Button';
import { ItemCard, LoadError, PageHead, Pager, styles } from '../../components/content/Blocks';
import { apiGet, formatDate, param, query } from '../../lib/content';
import { isSearchType, SEARCH_SORT, SEARCH_TYPES, type SearchHit } from '../../lib/search';

const LIMIT = 20;

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Поиск', robots: { index: false } };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = param(sp, 'q') ?? '';
  const rawType = param(sp, 'type');
  const type = isSearchType(rawType) ? rawType : undefined;
  const sort = param(sp, 'sort') === 'date' ? 'date' : undefined;
  const page = Math.min(50, Math.max(1, Number(param(sp, 'page')) || 1));
  const res =
    q.length >= 2
      ? await apiGet<{ items: SearchHit[]; total: number }>(
          `/api/search${query({ q, type, sort, page: page > 1 ? page : undefined, limit: LIMIT })}`,
        )
      : null;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Поиск"
        description="По новостям, объявлениям, организациям и услугам, событиям, справочнику, вакансиям, находкам, группам и постам. Ищем только опубликованное и доступное всем."
        crumbs={[{ label: 'Поиск' }]}
      />
      <form method="get" action="/search" className={styles.filters} role="search">
        <SearchField defaultValue={q} />
        <Select label="Раздел" name="type" defaultValue={type ?? ''}>
          <option value="">Все разделы</option>
          {Object.entries(SEARCH_TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
        <Select label="Порядок" name="sort" defaultValue={sort ?? 'relevance'}>
          {Object.entries(SEARCH_SORT).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
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
          <p aria-live="polite">Найдено: {res.data.total}</p>
          <div className={styles.list}>
            {res.data.items.map((h) => (
              <ItemCard
                key={`${h.type}-${h.slug}`}
                href={SEARCH_TYPES[h.type].href(h.slug)}
                title={h.title}
                badges={<Badge>{SEARCH_TYPES[h.type].label}</Badge>}
                meta={h.date && <time dateTime={h.date}>{formatDate(h.date)}</time>}
              >
                {h.snippet && <p className={styles.excerpt}>{h.snippet}</p>}
              </ItemCard>
            ))}
          </div>
          <Pager
            path="/search"
            page={page}
            total={res.data.total}
            limit={LIMIT}
            params={{ q, type, sort }}
          />
        </>
      )}
    </main>
  );
}
