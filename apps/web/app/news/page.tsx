import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '../../components/ui/Feedback';
import {
  Empty,
  Filters,
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

function NewsBadges({ item }: { item: NewsItem }) {
  return (
    <div className={styles.meta}>
      {item.pinned && <Badge tone="accent">Закреплено</Badge>}
      {item.category && <Badge>{item.category.name}</Badge>}
      {item.isDemo && <Badge tone="warning">демо</Badge>}
      <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
    </div>
  );
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
  const items = list.ok ? list.data.items : [];
  const featured = page === 1 && !q && !category;
  const lead = featured ? items[0] : undefined;
  const rest = featured ? items.slice(1) : items;
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
          {lead && (
            <article className={styles.leadStory}>
              <NewsBadges item={lead} />
              <h2>
                <Link href={`/news/${lead.slug}`} className={styles.storyLink}>
                  {lead.title}
                </Link>
              </h2>
              {lead.excerpt && <p>{lead.excerpt}</p>}
            </article>
          )}
          <ul className={styles.rows} role="list">
            {rest.map((n) => (
              <li key={n.id}>
                <div>
                  <NewsBadges item={n} />
                  <h3>
                    <Link href={`/news/${n.slug}`} className={styles.storyLink}>
                      {n.title}
                    </Link>
                  </h3>
                  {n.excerpt && <p className={styles.excerpt}>{n.excerpt}</p>}
                </div>
              </li>
            ))}
          </ul>
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
