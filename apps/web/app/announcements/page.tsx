import type { Metadata } from 'next';
import { AnnouncementCard } from '../../components/content/AnnouncementCard';
import {
  ButtonLink,
  Empty,
  Filters,
  LoadError,
  PageHead,
  Pager,
  styles,
} from '../../components/content/Blocks';
import {
  apiGet,
  excerptOf,
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
          <div className={styles.adGrid}>
            {list.data.items.map((a) => (
              <AnnouncementCard
                key={a.id}
                heading="h2"
                a={{
                  ...a,
                  excerpt: excerptOf(a.description),
                  coverId: a.imageIds[0] ?? null,
                  photoCount: a.imageIds.length,
                }}
              />
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
