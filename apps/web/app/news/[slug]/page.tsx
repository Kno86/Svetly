import type { Metadata } from 'next';
import { ReportButton } from '../../../components/content/ReportButton';
import { notFound } from 'next/navigation';
import { Badge } from '../../../components/ui/Feedback';
import { LoadError, PageHead, styles } from '../../../components/content/Blocks';
import { apiGet, formatDate, paragraphs, type CategoryRef } from '../../../lib/content';

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
  const res = await apiGet<News>(`/api/news/${encodeURIComponent((await params).slug)}`);
  if (!res.ok && res.status === 404) notFound();
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
          {res.data.coverId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.cover} src={`/api/media/${res.data.coverId}`} alt="" />
          )}
          <div className={styles.body}>
            {paragraphs(res.data.body).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
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
          <ReportButton entityType="news" entityId={res.data.id} />
        </article>
      )}
    </main>
  );
}
