'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { PageHead, styles } from '../../../components/content/Blocks';
import { Button, ButtonLink } from '../../../components/ui/Button';
import { Alert, Badge, EmptyState, Skeleton } from '../../../components/ui/Feedback';
import { apiRequest, errorMessage } from '../../../lib/auth-client';
import { formatDate, formatPrice, type CategoryRef } from '../../../lib/content';

interface Mine {
  id: string;
  slug: string;
  title: string;
  status: 'pending' | 'published' | 'rejected' | 'closed' | 'archived';
  moderationNote: string | null;
  price: number | null;
  expiresAt: string | null;
  createdAt: string;
  category: CategoryRef;
}

export const STATUS: Record<
  Mine['status'],
  { label: string; tone: 'neutral' | 'success' | 'warning' | 'error' }
> = {
  pending: { label: 'На проверке', tone: 'warning' },
  published: { label: 'Опубликовано', tone: 'success' },
  rejected: { label: 'Отклонено', tone: 'error' },
  closed: { label: 'Снято', tone: 'neutral' },
  archived: { label: 'В архиве', tone: 'neutral' },
};

export function MyAnnouncements() {
  const router = useRouter();
  const saved = useSearchParams().get('saved');
  const [items, setItems] = useState<Mine[]>();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    const r = await apiRequest<Mine[]>('/api/me/announcements');
    if (r.status === 401) return router.replace('/login');
    if (!r.ok) return setError(errorMessage(r));
    setItems(r.data);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    void apiRequest<Mine[]>('/api/me/announcements').then((r) => {
      if (cancelled) return;
      if (r.status === 401) router.replace('/login');
      else if (!r.ok) setError(errorMessage(r));
      else setItems(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function close(id: string) {
    if (!window.confirm('Снять объявление с публикации? Вернуть его будет нельзя.')) return;
    const r = await apiRequest(`/api/announcements/${id}/close`, { body: {} });
    if (!r.ok) setError(errorMessage(r));
    await load();
  }

  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Мои объявления"
        crumbs={[{ label: 'Кабинет', href: '/account' }, { label: 'Мои объявления' }]}
        action={<ButtonLink href="/announcements/new">Подать объявление</ButtonLink>}
      />
      {saved === 'pending' && (
        <Alert tone="info" title="Отправлено на проверку. Мы сообщим о решении модератора здесь." />
      )}
      {saved === 'published' && <Alert tone="success" title="Объявление опубликовано." />}
      {error && <Alert tone="error" title={error} />}
      {!items && !error && <Skeleton height="10rem" />}
      {items?.length === 0 && (
        <EmptyState
          title="У вас пока нет объявлений"
          description="Разместите первое — это бесплатно."
          action={<ButtonLink href="/announcements/new">Подать объявление</ButtonLink>}
        />
      )}
      {items && items.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Объявление</th>
                <th scope="col">Статус</th>
                <th scope="col">Цена</th>
                <th scope="col">Активно до</th>
                <th scope="col">
                  <span className="visually-hidden">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.status === 'published' ? (
                      <Link href={`/announcements/${a.slug}`}>{a.title}</Link>
                    ) : (
                      a.title
                    )}
                    <div className={styles.meta}>{a.category.name}</div>
                  </td>
                  <td>
                    <Badge tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Badge>
                    {a.moderationNote && (
                      <p className={styles.source}>Причина: {a.moderationNote}</p>
                    )}
                  </td>
                  <td>{formatPrice(a.price)}</td>
                  <td>{a.status === 'published' && a.expiresAt ? formatDate(a.expiresAt) : '—'}</td>
                  <td>
                    {['pending', 'published', 'rejected'].includes(a.status) && (
                      <div className={styles.row}>
                        <ButtonLink
                          href={`/announcements/${a.id}/edit`}
                          size="sm"
                          variant="secondary"
                        >
                          Изменить
                        </ButtonLink>
                        <Button size="sm" variant="ghost" onClick={() => void close(a.id)}>
                          Снять
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
