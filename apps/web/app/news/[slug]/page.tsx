import { MediaImage } from '../../../components/content/MediaImage';
import { RichText } from '../../../components/content/RichText';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ReportButton } from '../../../components/content/ReportButton';
import { FavoriteButton } from '../../../components/content/FavoriteButton';
import { ShareButton } from '../../../components/content/ShareButton';
import { notFound } from 'next/navigation';
import { Badge } from '../../../components/ui/Feedback';
import { LoadError, PageHead, styles } from '../../../components/content/Blocks';
import { apiGet, formatDate, type CategoryRef, type Paged } from '../../../lib/content';

export const dynamic = 'force-dynamic';

interface News {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverId: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  publishedAt: string;
  updatedAt: string;
  isDemo: boolean;
  category: CategoryRef | null;
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const res = await apiGet<News>(`/api/news/${encodeURIComponent((await params).slug)}`);
  if (!res.ok) return { title: 'Новость' };
  return {
    title: res.data.title,
    description: res.data.excerpt || undefined,
    openGraph: { title: res.data.title, description: res.data.excerpt, type: 'article' },
  };
}

export default async function NewsArticlePage({ params }: Props) {
  const slug = (await params).slug;
  const [res, latest] = await Promise.all([
    apiGet<News>(`/api/news/${encodeURIComponent(slug)}`),
    apiGet<Paged<Pick<News, 'id' | 'slug' | 'title' | 'publishedAt'>>>('/api/news?limit=4'),
  ]);
  if (!res.ok && res.status === 404) notFound();
  const related = latest.ok ? latest.data.items.filter((n) => n.slug !== slug).slice(0, 3) : [];
  return (
    <main id="main" className={`container ${styles.page}`}>
      {!res.ok ? (
        <LoadError />
      ) : (
        <article className={styles.article}>
          <PageHead
            title=""
            crumbs={[{ label: 'Новости', href: '/news' }, { label: res.data.title }]}
          />
          <div className={styles.meta}>
            {res.data.category && <Badge>{res.data.category.name}</Badge>}
            {res.data.isDemo && <Badge tone="warning">демо</Badge>}
            <time dateTime={res.data.publishedAt}>{formatDate(res.data.publishedAt, true)}</time>
          </div>
          <h1>{res.data.title}</h1>
          {res.data.excerpt && <p className={styles.articleLead}>{res.data.excerpt}</p>}
          {res.data.coverId && (
            <MediaImage
              className={styles.cover}
              id={res.data.coverId}
              alt=""
              variant="cover"
              eager
            />
          )}
          <div className={styles.body}>
            <RichText text={res.data.body} />
          </div>
          <dl className={styles.facts}>
            {res.data.sourceName && (
              <>
                <dt>Источник</dt>
                <dd>
                  {res.data.sourceUrl ? (
                    <a href={res.data.sourceUrl} rel="noopener noreferrer nofollow" target="_blank">
                      {res.data.sourceName}
                    </a>
                  ) : (
                    res.data.sourceName
                  )}
                </dd>
              </>
            )}
            <dt>Обновлено</dt>
            <dd>{formatDate(res.data.updatedAt, true)}</dd>
          </dl>
          <div className={styles.actions}>
            <ShareButton title={res.data.title} />
            <FavoriteButton entityType="news" entityId={res.data.id} />
          </div>
          <ReportButton entityType="news" entityId={res.data.id} />
        </article>
      )}
      {related.length > 0 && (
        <section className={styles.related} aria-labelledby="related-heading">
          <h2 id="related-heading">Ещё новости</h2>
          <ul className={styles.rows} role="list">
            {related.map((n) => (
              <li key={n.id}>
                <div>
                  <div className={styles.meta}>
                    <time dateTime={n.publishedAt}>{formatDate(n.publishedAt)}</time>
                  </div>
                  <h3>
                    <Link href={`/news/${n.slug}`} className={styles.storyLink}>
                      {n.title}
                    </Link>
                  </h3>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
