'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PageHead, styles } from '../../components/content/Blocks';
import css from '../../components/messages/messages.module.css';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Alert, Badge, EmptyState, Skeleton } from '../../components/ui/Feedback';
import { apiRequest, errorMessage } from '../../lib/auth-client';
import { formatDate } from '../../lib/content';
import type { NotificationItem } from '../../lib/messages';

interface Page {
  items: NotificationItem[];
  nextCursor: string | null;
}

export function NotificationsView() {
  const [items, setItems] = useState<NotificationItem[]>();
  const [next, setNext] = useState<string | null>(null);
  const [state, setState] = useState<'ok' | 'auth' | 'error'>('ok');
  const [error, setError] = useState<string>();

  const load = useCallback(async (cursor?: string) => {
    const r = await apiRequest<Page>(`/api/me/notifications${cursor ? `?cursor=${cursor}` : ''}`);
    if (r.status === 401) return setState('auth');
    if (!r.ok || !r.data) {
      if (cursor) return setError(errorMessage(r));
      return setState('error');
    }
    const page = r.data;
    setItems((cur) => (cursor && cur ? [...cur, ...page.items] : page.items));
    setNext(page.nextCursor);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function markAll() {
    const r = await apiRequest('/api/me/notifications/read', { body: {} });
    if (!r.ok) return setError(errorMessage(r));
    const now = new Date().toISOString();
    setItems((cur) => cur?.map((n) => ({ ...n, readAt: n.readAt ?? now })));
  }

  const unread = items?.filter((n) => !n.readAt).length ?? 0;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Уведомления"
        description="События по вашим постам, комментариям и группам. Уведомления видны только здесь, письма и push пока не отправляются."
        crumbs={[{ label: 'Кабинет', href: '/account' }, { label: 'Уведомления' }]}
        action={
          unread > 0 ? (
            <Button size="sm" variant="secondary" onClick={() => void markAll()}>
              Отметить все прочитанными
            </Button>
          ) : undefined
        }
      />
      {error && <Alert tone="error" title={error} />}
      {state === 'auth' ? (
        <EmptyState
          title="Войдите, чтобы увидеть уведомления"
          action={<ButtonLink href="/login">Войти</ButtonLink>}
        />
      ) : state === 'error' ? (
        <Alert tone="error" title="Не удалось загрузить уведомления. Обновите страницу." />
      ) : items === undefined ? (
        <Skeleton height="8rem" />
      ) : !items.length ? (
        <EmptyState
          title="Уведомлений пока нет"
          description="Здесь появятся ответы на ваши комментарии, решения модераторов и заявки в ваши группы."
        />
      ) : (
        <ul className={css.list}>
          {items.map((n) => (
            <li key={n.id} className={css.notification}>
              <span className={css.itemHead}>
                {n.href ? <Link href={n.href}>{n.title}</Link> : <strong>{n.title}</strong>}
                <span>{formatDate(n.createdAt, true)}</span>
              </span>
              {!n.readAt && <Badge tone="accent">новое</Badge>}
            </li>
          ))}
        </ul>
      )}
      {next && (
        <Button variant="secondary" onClick={() => void load(next)}>
          Показать ещё
        </Button>
      )}
    </main>
  );
}
