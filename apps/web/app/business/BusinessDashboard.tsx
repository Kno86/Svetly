'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageHead, styles } from '../../components/content/Blocks';
import { ButtonLink } from '../../components/ui/Button';
import { Alert, Badge, Card, EmptyState, Skeleton } from '../../components/ui/Feedback';
import { apiRequest, errorMessage } from '../../lib/auth-client';
import { ORG_STATUS } from '../../lib/community';
import { formatDate } from '../../lib/content';

export interface OwnedOrg {
  id: string;
  slug: string;
  kind: string;
  name: string;
  status: string;
  verification: string;
  reviewNote: string | null;
  pendingChanges: unknown;
  submittedAt: string | null;
  updatedAt: string;
  newInquiries: number;
}

export function BusinessDashboard() {
  const router = useRouter();
  const saved = useSearchParams().get('saved');
  const [items, setItems] = useState<OwnedOrg[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    void apiRequest<OwnedOrg[]>('/api/business/organizations').then((r) => {
      if (cancelled) return;
      if (r.status === 401) router.replace('/login');
      else if (!r.ok) setError(errorMessage(r));
      else setItems(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const add = <ButtonLink href="/business/new">Подать заявку на размещение</ButtonLink>;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Кабинет бизнеса"
        description="Карточки организаций и услуг, заявки жителей. Размещение бесплатное; каждая карточка и каждое изменение проходят проверку администратором."
        crumbs={[{ label: 'Кабинет бизнеса' }]}
        action={add}
      />
      {saved && (
        <Alert
          tone="success"
          title="Отправлено на проверку. Решение администратора появится здесь."
        />
      )}
      {error && <Alert tone="error" title={error} />}
      {!items && !error && <Skeleton height="10rem" />}
      {items?.length === 0 && (
        <EmptyState
          title="У вас пока нет карточек"
          description="Расскажите о своей организации или услуге. После проверки карточка появится в каталоге."
          action={add}
        />
      )}
      <div className={styles.list}>
        {items?.map((o) => (
          <Card key={o.id}>
            <div className={styles.meta}>
              <Badge tone={ORG_STATUS[o.status]?.tone}>
                {ORG_STATUS[o.status]?.label ?? o.status}
              </Badge>
              {o.pendingChanges !== null && <Badge tone="warning">Изменения на проверке</Badge>}
              <Badge tone={o.verification === 'verified' ? 'success' : 'neutral'}>
                {o.verification === 'verified' ? 'Данные проверены' : 'Данные не проверены'}
              </Badge>
              {o.newInquiries > 0 && <Badge tone="info">Новых заявок: {o.newInquiries}</Badge>}
            </div>
            <h2 className={styles.cardTitle}>
              <Link href={`/business/cards/${o.id}`}>{o.name}</Link>
            </h2>
            {o.reviewNote && (
              <p className={styles.excerpt}>Комментарий администратора: {o.reviewNote}</p>
            )}
            <p className={styles.excerpt}>
              {o.submittedAt
                ? `Отправлено ${formatDate(o.submittedAt, true)}`
                : `Обновлено ${formatDate(o.updatedAt)}`}
              {o.status === 'published' && (
                <>
                  {' · '}
                  <Link href={`/organizations/${o.slug}`}>Публичная карточка</Link>
                </>
              )}
            </p>
          </Card>
        ))}
      </div>
      <Alert tone="info" title="Статистика и продвижение">
        Просмотры, отзывы, продвижение и тарифы пока не подключены. Мы не показываем оценочных или
        вымышленных цифр.
      </Alert>
    </main>
  );
}
