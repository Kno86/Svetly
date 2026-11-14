import type { Metadata } from 'next';
import { Badge } from '../../components/ui/Feedback';
import { Empty, ItemCard, LoadError, PageHead, styles } from '../../components/content/Blocks';
import { POLL_PHASE } from '../../lib/community';
import { apiGet, formatDate } from '../../lib/content';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Опросы',
  description: 'Опросы жителей посёлка. Не являются официальным голосованием.',
};

interface PollItem {
  imageIds?: string[];
  slug: string;
  title: string;
  opensAt: string;
  closesAt: string;
  phase: 'upcoming' | 'open' | 'closed';
  votes: number | null;
}

export default async function PollsPage() {
  const list = await apiGet<PollItem[]>('/api/polls');
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Опросы"
        description="Опросы помогают узнать мнение соседей. Это не официальное голосование и не референдум: результаты не имеют юридической силы."
        crumbs={[{ label: 'Опросы' }]}
      />
      {!list.ok ? (
        <LoadError />
      ) : list.data.length === 0 ? (
        <Empty
          filtered={false}
          title="Опросов пока нет"
          description="Когда редакция запустит опрос, он появится здесь."
        />
      ) : (
        <div className={styles.list}>
          {list.data.map((p) => (
            <ItemCard
              key={p.slug}
              href={`/polls/${p.slug}`}
              imageId={p.imageIds?.[0]}
              title={p.title}
              badges={<Badge tone={POLL_PHASE[p.phase].tone}>{POLL_PHASE[p.phase].label}</Badge>}
              meta={
                <>
                  <span>
                    {formatDate(p.opensAt)} — {formatDate(p.closesAt)}
                  </span>
                  {p.votes !== null && <span>Ответов: {p.votes}</span>}
                </>
              }
            />
          ))}
        </div>
      )}
    </main>
  );
}
