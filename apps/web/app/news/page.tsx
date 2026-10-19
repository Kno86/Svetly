import type { Metadata } from 'next';
import { Badge } from '../../components/ui/Feedback';
import {
  Empty,
  Filters,
  ItemCard,
  LoadError,
  PageHead,
  Pager,
  styles,
} from '../../components/content/Blocks';
import {
  apiGet,
  formatDate,
  pageParam,
  param,
  query,
  type Category,
  type CategoryRef,
  type Paged,
} from '../../lib/content';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Новости',
  description: 'Новости посёлка Октябрьский и района Светлый.',
};

interface NewsItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  pinned: boolean;
  publishedAt: string;
  isDemo: boolean;
  category: CategoryRef | null;
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = param(sp, 'q');
  const category = param(sp, 'category');
  const page = pageParam(sp);
  const [list, cats] = await Promise.all([
    apiGet<Paged<NewsItem>>(`/api/news${query({ q, category, page })}`),
    apiGet<Category[]>('/api/categories?module=news'),
  ]);
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Новости"
        description="Публикуют редакторы платформы со ссылкой на источник."
        crumbs={[{ label: 'Новости' }]}
      />
      <Filters action="/news" q={q} category={category} categories={cats.ok ? cats.data : []} />
      {!list.ok ? (
        <LoadError />
      ) : list.data.items.length === 0 ? (
        <Empty
          filtered={Boolean(q || category)}
          title="Новостей пока нет"
          description="Первые новости появятся после проверки редакцией."
        />
      ) : (
        <>
          <div className={styles.list}>
            {list.data.items.map((n) => (
              <ItemCard
                key={n.id}
                href={`/news/${n.slug}`}
                title={n.title}
                badges={
                  <>
                    {n.pinned && <Badge tone="accent">Закреплено</Badge>}
                    {n.category && <Badge>{n.category.name}</Badge>}
                    {n.isDemo && <Badge tone="warning">демо</Badge>}
                  </>
                }
                meta={<time dateTime={n.publishedAt}>{formatDate(n.publishedAt)}</time>}
              >
                {n.excerpt && <p className={styles.excerpt}>{n.excerpt}</p>}
              </ItemCard>
            ))}
          </div>
          <Pager
            path="/news"
            page={page}
            total={list.data.total}
            limit={list.data.limit}
            params={{ q, category }}
          />
        </>
      )}
    </main>
  );
}
