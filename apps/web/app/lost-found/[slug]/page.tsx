import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ReportButton } from '../../../components/content/ReportButton';
import { FavoriteButton } from '../../../components/content/FavoriteButton';
import { LoadError, PageHead, styles } from '../../../components/content/Blocks';
import { Alert, Badge } from '../../../components/ui/Feedback';
import { LF_KIND, LF_SUBJECT, tel } from '../../../lib/community';
import { apiGet, formatDate, paragraphs } from '../../../lib/content';

export const dynamic = 'force-dynamic';

interface LfItem {
  id: string;
  kind: 'lost' | 'found';
  subject: 'item' | 'animal';
  title: string;
  description: string;
  area: string | null;
  happenedOn: string | null;
  imageIds: string[];
  contactPhone: string | null;
  publishedAt: string;
  expiresAt: string;
}
type Props = { params: Promise<{ slug: string }> };
const load = async (p: Props) =>
  apiGet<LfItem>(`/api/lost-found/${encodeURIComponent((await p.params).slug)}`);

export async function generateMetadata(p: Props): Promise<Metadata> {
  const res = await load(p);
  return { title: res.ok ? res.data.title : 'Потеряно и найдено' };
}

export default async function LostFoundItemPage(p: Props) {
  const res = await load(p);
  if (!res.ok && res.status === 404) notFound();
  if (!res.ok)
    return (
      <main id="main" className={`container ${styles.page}`}>
        <LoadError />
      </main>
    );
  const i = res.data;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <article className={styles.article}>
        <PageHead
          title=""
          crumbs={[{ label: 'Потеряно и найдено', href: '/lost-found' }, { label: i.title }]}
        />
        <div className={styles.meta}>
          <Badge tone={i.kind === 'lost' ? 'warning' : 'success'}>{LF_KIND[i.kind]}</Badge>
          <Badge>{LF_SUBJECT[i.subject]}</Badge>
        </div>
        <h1>{i.title}</h1>
        {i.imageIds.length > 0 && (
          <div className={styles.gallery}>
            {i.imageIds.map((id, n) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={id} src={`/api/media/${id}`} alt={`Фото ${n + 1}`} loading="lazy" />
            ))}
          </div>
        )}
        <div className={styles.body}>
          {paragraphs(i.description).map((t, n) => (
            <p key={n}>{t}</p>
          ))}
        </div>
        <dl className={styles.facts}>
          {i.area && (
            <>
              <dt>Где</dt>
              <dd>{i.area}</dd>
            </>
          )}
          {i.happenedOn && (
            <>
              <dt>Когда</dt>
              <dd>{formatDate(i.happenedOn)}</dd>
            </>
          )}
          <dt>Связь</dt>
          <dd>
            {i.contactPhone ? (
              <a href={tel(i.contactPhone)}>{i.contactPhone}</a>
            ) : (
              'Телефон не указан'
            )}
          </dd>
          <dt>Опубликовано</dt>
          <dd>{formatDate(i.publishedAt)}</dd>
        </dl>
        <div style={{ marginTop: 'var(--space-6)' }}>
          <Alert tone="info" title="Как вернуть безопасно">
            Попросите описать приметы, которых нет в объявлении. Не переводите деньги «за находку»
            заранее.
          </Alert>
        </div>
        <FavoriteButton entityType="lost_found" entityId={i.id} />
        <ReportButton entityType="lost_found" entityId={i.id} />
      </article>
    </main>
  );
}
