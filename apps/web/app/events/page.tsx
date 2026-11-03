import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '../../components/ui/Feedback';
import { buttonClass } from '../../components/ui/Button';
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
  dateParts,
  pageParam,
  param,
  query,
  type Category,
  type CategoryRef,
  type Paged,
} from '../../lib/content';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'События',
  description: 'Праздники, встречи, секции и мероприятия.',
};

interface EventItem {
  id: string;
  slug: string;
  title: string;
  location: string;
  startsAt: string;
  status: 'published' | 'cancelled';
  isDemo: boolean;
  category: CategoryRef | null;
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const when = param(sp, 'when') === 'past' ? 'past' : 'upcoming';
  const q = param(sp, 'q');
  const category = param(sp, 'category');
  const page = pageParam(sp);
  const [list, cats] = await Promise.all([
    apiGet<Paged<EventItem>>(`/api/events${query({ when, q, category, page })}`),
    apiGet<Category[]>('/api/categories?module=events'),
  ]);
  const tab = (value: 'upcoming' | 'past', label: string) => (
    <Link
      href={`/events${value === 'past' ? '?when=past' : ''}`}
      className={buttonClass({ variant: when === value ? 'primary' : 'secondary', size: 'sm' })}
      aria-current={when === value ? 'page' : undefined}
    >
      {label}
    </Link>
  );
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="События"
        description="Время указано по Новосибирску."
        crumbs={[{ label: 'События' }]}
      />
      <nav className={styles.tabs} aria-label="Период">
        {tab('upcoming', 'Предстоящие')}
        {tab('past', 'Прошедшие')}
      </nav>
      <Filters
        action="/events"
        q={q}
        category={category}
        categories={cats.ok ? cats.data : []}
        hidden={when === 'past' ? { when } : undefined}
      />
      {!list.ok ? (
        <LoadError />
      ) : list.data.items.length === 0 ? (
        <Empty
          filtered={Boolean(q || category)}
          title={when === 'past' ? 'Прошедших событий нет' : 'Ближайших событий пока нет'}
          description="События публикует редакция по данным организаторов."
        />
      ) : (
        <>
          <ul className={styles.rows} role="list">
            {list.data.items.map((e) => {
              const d = dateParts(e.startsAt);
              return (
                <li key={e.id}>
                  <time
                    dateTime={e.startsAt}
                    className={`${styles.dateBox} ${when === 'past' ? styles.dateBoxPast : ''}`}
                  >
                    <b>{d.day}</b>
                    <span>{d.month}</span>
                  </time>
                  <div>
                    <div className={styles.meta}>
                      {e.status === 'cancelled' && <Badge tone="error">Отменено</Badge>}
                      {e.category && <Badge>{e.category.name}</Badge>}
                      {e.isDemo && <Badge tone="warning">демо</Badge>}
                    </div>
                    <h2>
                      <Link href={`/events/${e.slug}`} className={styles.storyLink}>
                        {e.title}
                      </Link>
                    </h2>
                    <div className={styles.meta}>
                      <span>{d.time}</span>
                      <span>{e.location}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pager
            path="/events"
            page={page}
            total={list.data.total}
            limit={list.data.limit}
            params={{ when: when === 'past' ? when : undefined, q, category }}
          />
        </>
      )}
    </main>
  );
}
