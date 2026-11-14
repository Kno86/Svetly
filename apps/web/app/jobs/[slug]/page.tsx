import { PhotoGallery } from '../../../components/content/PhotoGallery';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ReportButton } from '../../../components/content/ReportButton';
import { FavoriteButton } from '../../../components/content/FavoriteButton';
import { ShareButton } from '../../../components/content/ShareButton';
import { LoadError, PageHead, styles } from '../../../components/content/Blocks';
import { Alert } from '../../../components/ui/Feedback';
import { tel } from '../../../lib/community';
import { apiGet, formatDate, paragraphs } from '../../../lib/content';

export const dynamic = 'force-dynamic';

interface Job {
  imageIds?: string[];
  id: string;
  title: string;
  employer: string;
  description: string;
  conditions: string;
  requirements: string;
  salary: string | null;
  schedule: string | null;
  area: string | null;
  contactPhone: string | null;
  contactNote: string | null;
  publishedAt: string;
  expiresAt: string;
}
type Props = { params: Promise<{ slug: string }> };

const load = async (p: Props) =>
  apiGet<Job>(`/api/jobs/${encodeURIComponent((await p.params).slug)}`);

export async function generateMetadata(p: Props): Promise<Metadata> {
  const res = await load(p);
  if (!res.ok) return { title: 'Вакансия' };
  const description = res.data.description.slice(0, 160);
  return {
    title: res.data.title,
    description,
    openGraph: { title: res.data.title, description, type: 'article' },
  };
}

export default async function JobPage(p: Props) {
  const res = await load(p);
  if (!res.ok && res.status === 404) notFound();
  if (!res.ok)
    return (
      <main id="main" className={`container ${styles.page}`}>
        <LoadError />
      </main>
    );
  const j = res.data;
  const section = (title: string, text: string) =>
    text ? (
      <>
        <h2>{title}</h2>
        {paragraphs(text).map((t, i) => (
          <p key={i}>{t}</p>
        ))}
      </>
    ) : null;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <article className={styles.article}>
        <PageHead title="" crumbs={[{ label: 'Вакансии', href: '/jobs' }, { label: j.title }]} />
        <h1>{j.title}</h1>
        <PhotoGallery ids={j.imageIds ?? []} title={j.title} />
        <p className={styles.price}>{j.salary ?? 'Оплата не указана'}</p>
        <div className={styles.body}>
          {paragraphs(j.description).map((t, i) => (
            <p key={i}>{t}</p>
          ))}
          {section('Условия', j.conditions)}
          {section('Требования', j.requirements)}
        </div>
        <dl className={styles.facts}>
          <dt>Работодатель</dt>
          <dd>{j.employer}</dd>
          {j.schedule && (
            <>
              <dt>График</dt>
              <dd>{j.schedule}</dd>
            </>
          )}
          {j.area && (
            <>
              <dt>Место</dt>
              <dd>{j.area}</dd>
            </>
          )}
          <dt>Связь</dt>
          <dd>
            {j.contactPhone ? (
              <a href={tel(j.contactPhone)}>{j.contactPhone}</a>
            ) : (
              'Телефон не указан'
            )}
            {j.contactNote && <> · {j.contactNote}</>}
          </dd>
          <dt>Опубликовано</dt>
          <dd>{formatDate(j.publishedAt)}</dd>
          <dt>Актуально до</dt>
          <dd>{formatDate(j.expiresAt)}</dd>
        </dl>
        <div style={{ marginTop: 'var(--space-6)' }}>
          <Alert tone="info" title="Платформа не проверяет работодателей">
            Не платите за трудоустройство и не передавайте паспортные данные до личной встречи.
          </Alert>
        </div>
        <div className={styles.actions}>
          <ShareButton title={j.title} />
          <FavoriteButton entityType="job" entityId={j.id} />
        </div>
        <ReportButton entityType="job" entityId={j.id} />
      </article>
    </main>
  );
}
