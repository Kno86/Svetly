import { PhotoGallery } from '../../../components/content/PhotoGallery';
import type { Metadata } from 'next';
import { ReportButton } from '../../../components/content/ReportButton';
import { FavoriteButton } from '../../../components/content/FavoriteButton';
import { ShareButton } from '../../../components/content/ShareButton';
import { notFound } from 'next/navigation';
import { Alert, Badge } from '../../../components/ui/Feedback';
import { LoadError, PageHead, styles } from '../../../components/content/Blocks';
import {
  apiGet,
  formatDate,
  formatPrice,
  paragraphs,
  type CategoryRef,
} from '../../../lib/content';

export const dynamic = 'force-dynamic';

interface Announcement {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: number | null;
  condition: 'new' | 'used' | null;
  area: string | null;
  contactPhone: string | null;
  imageIds: string[];
  publishedAt: string;
  expiresAt: string;
  isDemo: boolean;
  category: CategoryRef;
}
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const res = await apiGet<Announcement>(
    `/api/announcements/${encodeURIComponent((await params).slug)}`,
  );
  if (!res.ok) return { title: 'Объявление' };
  const description = res.data.description.slice(0, 160);
  return {
    title: res.data.title,
    description,
    openGraph: { title: res.data.title, description, type: 'article' },
  };
}

export default async function AnnouncementPage({ params }: Props) {
  const res = await apiGet<Announcement>(
    `/api/announcements/${encodeURIComponent((await params).slug)}`,
  );
  if (!res.ok && res.status === 404) notFound();
  if (!res.ok)
    return (
      <main id="main" className={`container ${styles.page}`}>
        <LoadError />
      </main>
    );
  const a = res.data;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <article className={styles.article}>
        <PageHead
          title=""
          crumbs={[{ label: 'Объявления', href: '/announcements' }, { label: a.title }]}
        />
        <div className={styles.meta}>
          <Badge>{a.category.name}</Badge>
          {a.condition && <Badge>{a.condition === 'new' ? 'Новое' : 'Б/у'}</Badge>}
          {a.isDemo && <Badge tone="warning">демо</Badge>}
        </div>
        <h1>{a.title}</h1>
        <p className={styles.price}>{formatPrice(a.price)}</p>
        <PhotoGallery ids={a.imageIds} title={a.title} />
        <div className={styles.body}>
          {paragraphs(a.description).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <dl className={styles.facts}>
          {a.area && (
            <>
              <dt>Район</dt>
              <dd>{a.area}</dd>
            </>
          )}
          <dt>Связь</dt>
          <dd>
            {a.contactPhone ? (
              <a href={`tel:${a.contactPhone.replace(/[^+0-9]/g, '')}`}>{a.contactPhone}</a>
            ) : (
              'Автор не указал телефон'
            )}
          </dd>
          <dt>Опубликовано</dt>
          <dd>{formatDate(a.publishedAt, true)}</dd>
          <dt>Активно до</dt>
          <dd>{formatDate(a.expiresAt)}</dd>
        </dl>
        <div style={{ marginTop: 'var(--space-6)' }}>
          <Alert tone="info" title="Будьте осторожны">
            Не переводите предоплату незнакомым людям. Платформа не участвует в сделках между
            жителями.
          </Alert>
        </div>
        <div className={styles.actions}>
          <ShareButton title={a.title} />
          <FavoriteButton entityType="announcement" entityId={a.id} />
        </div>
        <ReportButton entityType="announcement" entityId={a.id} />
      </article>
    </main>
  );
}
