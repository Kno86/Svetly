import type { Metadata } from 'next';
import { Badge } from '../../components/ui/Feedback';
import {
  ButtonLink,
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
  formatPrice,
  pageParam,
  param,
  query,
  type Category,
  type CategoryRef,
  type Paged,
} from '../../lib/content';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Объявления',
  description: 'Частные объявления жителей: продать, купить, отдать, найти.',
};

export interface AnnouncementItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: number | null;
  area: string | null;
  imageIds: string[];
  publishedAt: string;
  isDemo: boolean;
  category: CategoryRef;
}

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = param(sp, 'q');
  const category = param(sp, 'category');
  const page = pageParam(sp);
  const [list, cats] = await Promise.all([
    apiGet<Paged<AnnouncementItem>>(`/api/announcements${query({ q, category, page })}`),
    apiGet<Category[]>('/api/categories?module=announcements'),
  ]);
  const add = <ButtonLink href="/announcements/new">Подать объявление</ButtonLink>;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Объявления"
        description="Объявления новых авторов проверяет модератор. Срок размещения — 30 дней."
        crumbs={[{ label: 'Объявления' }]}
        action={add}
      />
      <Filters
        action="/announcements"
        q={q}
        category={category}
        categories={cats.ok ? cats.data : []}
      />
      {!list.ok ? (
        <LoadError />
      ) : list.data.items.length === 0 ? (
        <Empty
          filtered={Boolean(q || category)}
          title="Объявлений пока нет"
          description="Станьте первым — разместите объявление бесплатно."
          action={add}
        />
      ) : (
        <>
          <div className={styles.list}>
            {list.data.items.map((a) => (
              <ItemCard
                key={a.id}
                href={`/announcements/${a.slug}`}
                title={a.title}
                badges={
                  <>
                    <Badge>{a.category.name}</Badge>
                    {a.isDemo && <Badge tone="warning">демо</Badge>}
                  </>
                }
                meta={
                  <>
                    {a.area && <span>{a.area}</span>}
                    <time dateTime={a.publishedAt}>{formatDate(a.publishedAt)}</time>
                  </>
                }
              >
                <p className={styles.price}>{formatPrice(a.price)}</p>
              </ItemCard>
            ))}
          </div>
          <Pager
            path="/announcements"
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
