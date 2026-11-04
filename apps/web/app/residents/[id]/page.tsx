import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Empty, LoadError, PageHead, styles } from '../../../components/content/Blocks';
import { apiGet, formatDate, paragraphs } from '../../../lib/content';
import { sinceMonth } from '../../../lib/calendar';

export const dynamic = 'force-dynamic';

interface Resident {
  id: string;
  name: string;
  bio: string;
  memberSince: string;
  groups: Array<{ slug: string; name: string }>;
  posts: Array<{
    id: string;
    body: string;
    publishedAt: string | null;
    group: { slug: string; name: string } | null;
  }>;
}
type Props = { params: Promise<{ id: string }> };

const load = async (params: Props['params']) =>
  apiGet<Resident>(`/api/residents/${encodeURIComponent((await params).id)}`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const res = await load(params);
  // Profiles are opt-in and personal: never indexed by search engines.
  return { title: res.ok ? res.data.name : 'Профиль жителя', robots: { index: false } };
}

export default async function ResidentPage({ params }: Props) {
  const res = await load(params);
  if (!res.ok && (res.status === 404 || res.status === 400)) notFound();
  if (!res.ok)
    return (
      <main id="main" className={`container ${styles.page}`}>
        <LoadError />
      </main>
    );
  const r = res.data;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title={r.name}
        description={`На SVETLY ${sinceMonth(r.memberSince)}`}
        crumbs={[{ label: 'Сообщество', href: '/community' }, { label: r.name }]}
      />
      {r.bio && (
        <section className={styles.profileSection} aria-labelledby="bio">
          <h2 id="bio">О себе</h2>
          {paragraphs(r.bio).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>
      )}
      <section className={styles.profileSection} aria-labelledby="groups">
        <h2 id="groups">Открытые группы</h2>
        {r.groups.length ? (
          <ul>
            {r.groups.map((g) => (
              <li key={g.slug}>
                <Link href={`/groups/${g.slug}`}>{g.name}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.meta}>Не состоит в открытых группах.</p>
        )}
      </section>
      <section className={styles.profileSection} aria-labelledby="posts">
        <h2 id="posts">Публичные посты</h2>
        {r.posts.length ? (
          <ul className={styles.rows} role="list">
            {r.posts.map((p) => (
              <li key={p.id}>
                <p className={styles.meta}>
                  {p.publishedAt && formatDate(p.publishedAt, true)}
                  {p.group && <> · {p.group.name}</>}
                </p>
                <Link href={`/feed/${p.id}`}>{p.body}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty
            filtered={false}
            title="Публичных постов пока нет"
            description="Здесь появятся посты из общей ленты и открытых групп."
          />
        )}
      </section>
    </main>
  );
}
