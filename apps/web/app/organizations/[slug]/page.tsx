import type { Metadata } from 'next';
import { ReportButton } from '../../../components/content/ReportButton';
import { notFound } from 'next/navigation';
import { Badge } from '../../../components/ui/Feedback';
import { LoadError, PageHead, styles } from '../../../components/content/Blocks';
import { VerificationBadge } from '../../../components/content/OrganizationList';
import { apiGet, formatDate, paragraphs, type CategoryRef } from '../../../lib/content';

export const dynamic = 'force-dynamic';

interface Org {
  id: string;
  kind: 'organization' | 'service';
  name: string;
  description: string;
  services: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  serviceArea: string | null;
  hours: string | null;
  hoursCheckedAt: string | null;
  verification: 'unverified' | 'verified';
  sourceName: string | null;
  sourceUrl: string | null;
  checkedAt: string | null;
  updatedAt: string;
  isDemo: boolean;
  category: CategoryRef | null;
}
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const res = await apiGet<Org>(`/api/organizations/${encodeURIComponent((await params).slug)}`);
  return {
    title: res.ok ? res.data.name : 'Организация',
    description: res.ok ? res.data.description.slice(0, 160) : undefined,
  };
}

export default async function OrganizationPage({ params }: Props) {
  const res = await apiGet<Org>(`/api/organizations/${encodeURIComponent((await params).slug)}`);
  if (!res.ok && res.status === 404) notFound();
  if (!res.ok)
    return (
      <main id="main" className={`container ${styles.page}`}>
        <LoadError />
      </main>
    );
  const o = res.data;
  const section =
    o.kind === 'service'
      ? { label: 'Услуги', href: '/services' }
      : { label: 'Организации', href: '/organizations' };
  return (
    <main id="main" className={`container ${styles.page}`}>
      <article className={styles.article}>
        <PageHead title="" crumbs={[section, { label: o.name }]} />
        <div className={styles.meta}>
          {o.category && <Badge>{o.category.name}</Badge>}
          <VerificationBadge value={o.verification} />
          {o.isDemo && <Badge tone="warning">демо</Badge>}
        </div>
        <h1>{o.name}</h1>
        <div className={styles.body}>
          {paragraphs(o.description).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        {o.services && (
          <>
            <h2 style={{ marginTop: 'var(--space-8)', fontSize: 'var(--font-size-xl)' }}>
              Услуги и цены
            </h2>
            <div className={styles.body}>{o.services}</div>
          </>
        )}
        <dl className={styles.facts}>
          {o.address && (
            <>
              <dt>Адрес</dt>
              <dd>{o.address}</dd>
            </>
          )}
          {o.serviceArea && (
            <>
              <dt>Зона работы</dt>
              <dd>{o.serviceArea}</dd>
            </>
          )}
          {o.hours && (
            <>
              <dt>Часы работы</dt>
              <dd>
                {o.hours}
                {o.hoursCheckedAt && <> (проверено {formatDate(o.hoursCheckedAt)})</>}
              </dd>
            </>
          )}
          {o.phone && (
            <>
              <dt>Телефон</dt>
              <dd>
                <a href={`tel:${o.phone.replace(/[^+0-9]/g, '')}`}>{o.phone}</a>
              </dd>
            </>
          )}
          {o.website && (
            <>
              <dt>Сайт</dt>
              <dd>
                <a href={o.website} rel="noopener noreferrer nofollow" target="_blank">
                  {o.website}
                </a>
              </dd>
            </>
          )}
          <dt>Источник</dt>
          <dd>
            {o.sourceName ? (
              o.sourceUrl ? (
                <a href={o.sourceUrl} rel="noopener noreferrer nofollow" target="_blank">
                  {o.sourceName}
                </a>
              ) : (
                o.sourceName
              )
            ) : (
              'не указан'
            )}
          </dd>
          <dt>Проверено</dt>
          <dd>{o.checkedAt ? formatDate(o.checkedAt) : 'нет данных'}</dd>
        </dl>
        <ReportButton entityType="organization" entityId={o.id} />
      </article>
    </main>
  );
}
