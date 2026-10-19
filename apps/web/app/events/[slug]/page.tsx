import type { Metadata } from 'next';
import { ReportButton } from '../../../components/content/ReportButton';
import { FavoriteButton } from '../../../components/content/FavoriteButton';
import { notFound } from 'next/navigation';
import { Alert, Badge } from '../../../components/ui/Feedback';
import { ButtonLink, LoadError, PageHead, styles } from '../../../components/content/Blocks';
import { apiGet, eventPhase, formatDate, paragraphs, type CategoryRef } from '../../../lib/content';
import { EventRegistration } from './EventRegistration';

export const dynamic = 'force-dynamic';

interface EventDetail {
  id: string;
  title: string;
  description: string;
  organizer: string;
  location: string;
  startsAt: string;
  endsAt: string | null;
  registrationUrl: string | null;
  capacity: number | null;
  status: 'published' | 'cancelled';
  registered: number;
  isDemo: boolean;
  category: CategoryRef | null;
}
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const res = await apiGet<EventDetail>(`/api/events/${encodeURIComponent((await params).slug)}`);
  return { title: res.ok ? res.data.title : 'Событие' };
}

export default async function EventPage({ params }: Props) {
  const res = await apiGet<EventDetail>(`/api/events/${encodeURIComponent((await params).slug)}`);
  if (!res.ok && res.status === 404) notFound();
  if (!res.ok)
    return (
      <main id="main" className={`container ${styles.page}`}>
        <LoadError />
      </main>
    );
  const e = res.data;
  const { started, ended } = eventPhase(e.startsAt, e.endsAt);
  return (
    <main id="main" className={`container ${styles.page}`}>
      <article className={styles.article}>
        <PageHead title="" crumbs={[{ label: 'События', href: '/events' }, { label: e.title }]} />
        <div className={styles.meta}>
          {e.status === 'cancelled' && <Badge tone="error">Отменено</Badge>}
          {ended && e.status !== 'cancelled' && <Badge>Прошло</Badge>}
          {e.category && <Badge>{e.category.name}</Badge>}
          {e.isDemo && <Badge tone="warning">демо</Badge>}
        </div>
        <h1>{e.title}</h1>
        <dl className={styles.facts}>
          <dt>Начало</dt>
          <dd>{formatDate(e.startsAt, true)} (Новосибирск)</dd>
          {e.endsAt && (
            <>
              <dt>Окончание</dt>
              <dd>{formatDate(e.endsAt, true)}</dd>
            </>
          )}
          <dt>Место</dt>
          <dd>{e.location}</dd>
          <dt>Организатор</dt>
          <dd>{e.organizer}</dd>
          {e.capacity !== null && (
            <>
              <dt>Мест</dt>
              <dd>
                {Math.max(0, e.capacity - e.registered)} из {e.capacity} свободно
              </dd>
            </>
          )}
        </dl>
        <div className={styles.body}>
          {paragraphs(e.description).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className={styles.actions}>
          {e.status === 'cancelled' ? (
            <Alert tone="warning" title="Событие отменено организатором" />
          ) : started ? null : e.registrationUrl ? (
            <ButtonLink href={e.registrationUrl} rel="noopener noreferrer nofollow" target="_blank">
              Регистрация на сайте организатора
            </ButtonLink>
          ) : (
            <EventRegistration
              eventId={e.id}
              full={e.capacity !== null && e.registered >= e.capacity}
            />
          )}
        </div>
        <FavoriteButton entityType="event" entityId={e.id} />
        <ReportButton entityType="event" entityId={e.id} />
      </article>
    </main>
  );
}
