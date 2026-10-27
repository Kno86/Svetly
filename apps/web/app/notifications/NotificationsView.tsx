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
  unread: Record<string, number>;
}
interface Setting {
  key: string;
  label: string;
  optional: boolean;
  enabled: boolean;
}

export function NotificationsView() {
  const [items, setItems] = useState<NotificationItem[]>();
  const [next, setNext] = useState<string | null>(null);
  const [state, setState] = useState<'ok' | 'auth' | 'error'>('ok');
  const [error, setError] = useState<string>();
  const [category, setCategory] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState<Setting[]>();

  useEffect(() => {
    void apiRequest<{ categories: Setting[] }>('/api/me/notification-settings').then((r) => {
      if (r.ok && r.data) setSettings(r.data.categories);
    });
  }, []);

  const load = useCallback(
    async (cursor?: string) => {
      const qs = new URLSearchParams();
      if (cursor) qs.set('cursor', cursor);
      if (category) qs.set('category', category);
      const r = await apiRequest<Page>(`/api/me/notifications${qs.size ? `?${qs}` : ''}`);
      if (r.status === 401) return setState('auth');
      if (!r.ok || !r.data) {
        if (cursor) return setError(errorMessage(r));
        return setState('error');
      }
      const page = r.data;
      setItems((cur) => (cursor && cur ? [...cur, ...page.items] : page.items));
      setNext(page.nextCursor);
      setCounts(page.unread);
    },
    [category],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function markAll() {
    const r = await apiRequest('/api/me/notifications/read', {
      body: category ? { category } : {},
    });
    if (!r.ok) return setError(errorMessage(r));
    const now = new Date().toISOString();
    setItems((cur) => cur?.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    setCounts((c) => (category ? { ...c, [category]: 0 } : {}));
  }

  async function toggle(key: string, enabled: boolean) {
    const r = await apiRequest<{ categories: Setting[] }>('/api/me/notification-settings', {
      method: 'PUT',
      body: { categories: { [key]: enabled } },
    });
    if (!r.ok || !r.data) return setError(errorMessage(r));
    setSettings(r.data.categories);
  }

  const unread = items?.filter((n) => !n.readAt).length ?? 0;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Уведомления"
        description="Решения модераторов, ответы и комментарии, группы, обращения и заявки бизнеса. Уведомления видны только здесь, письма и push пока не отправляются."
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
      {settings && state === 'ok' && (
        <nav className={css.filters} aria-label="Категории уведомлений">
          {[{ key: '', label: 'Все' }, ...settings].map((c) => (
            <Button
              key={c.key || 'all'}
              size="sm"
              variant={category === c.key ? 'primary' : 'secondary'}
              aria-pressed={category === c.key}
              onClick={() => setCategory(c.key)}
            >
              {c.label}
              {c.key && counts[c.key] ? ` (${counts[c.key]})` : ''}
            </Button>
          ))}
        </nav>
      )}
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
      {settings && state === 'ok' && (
        <section className={css.settings} aria-labelledby="notification-settings">
          <h2 id="notification-settings">Настройки</h2>
          <p>
            Служебные уведомления (модерация, обращения, бизнес, системные) отключить нельзя. Каналы
            email, Telegram и push пока не подключены — уведомления видны только на этой странице.
          </p>
          {settings.map((c) => (
            <label key={c.key} className={css.settingRow}>
              <input
                type="checkbox"
                checked={c.enabled}
                disabled={!c.optional}
                onChange={(e) => void toggle(c.key, e.target.checked)}
              />
              {c.label}
              {!c.optional && ' — обязательные'}
            </label>
          ))}
        </section>
      )}
    </main>
  );
}
