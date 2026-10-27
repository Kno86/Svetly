'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PageHead, styles } from '../../components/content/Blocks';
import css from '../../components/messages/messages.module.css';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Alert, Badge, EmptyState, Skeleton } from '../../components/ui/Feedback';
import { apiRequest, errorMessage } from '../../lib/auth-client';
import { formatDate } from '../../lib/content';
import { conversationPreview, type ConversationSummary } from '../../lib/messages';

interface Page {
  items: ConversationSummary[];
  nextCursor: string | null;
}

export function MessagesView() {
  const [items, setItems] = useState<ConversationSummary[]>();
  const [next, setNext] = useState<string | null>(null);
  const [state, setState] = useState<'ok' | 'auth' | 'error'>('ok');
  const [error, setError] = useState<string>();

  const load = useCallback(async (cursor?: string) => {
    const r = await apiRequest<Page>(`/api/me/conversations${cursor ? `?cursor=${cursor}` : ''}`);
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

  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Сообщения"
        description="Личная переписка с авторами постов и комментариев. Новые сообщения подгружаются периодически, мгновенная доставка не гарантируется."
        crumbs={[{ label: 'Кабинет', href: '/account' }, { label: 'Сообщения' }]}
      />
      {state === 'auth' ? (
        <EmptyState
          title="Войдите, чтобы увидеть сообщения"
          action={<ButtonLink href="/login">Войти</ButtonLink>}
        />
      ) : state === 'error' ? (
        <Alert tone="error" title="Не удалось загрузить переписки. Обновите страницу." />
      ) : items === undefined ? (
        <Skeleton height="8rem" />
      ) : !items.length ? (
        <EmptyState
          title="Переписок пока нет"
          description="Написать можно автору поста или комментария: кнопка «Написать автору» есть на странице обсуждения."
          action={<ButtonLink href="/feed">Открыть ленту</ButtonLink>}
        />
      ) : (
        <ul className={css.list}>
          {items.map((c) => (
            <li key={c.id} className={c.unread ? css.unreadItem : undefined}>
              <Link href={`/messages/${c.id}`} className={css.item}>
                <span className={css.itemHead}>
                  <strong>{c.other?.name ?? 'Пользователь'}</strong>
                  {c.lastMessageAt && <span>{formatDate(c.lastMessageAt, true)}</span>}
                </span>
                <span className={css.preview}>{conversationPreview(c)}</span>
                {c.unread > 0 && <Badge tone="accent">Новых: {c.unread}</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {error && <Alert tone="error" title={error} />}
      {next && (
        <Button variant="secondary" onClick={() => void load(next)}>
          Показать ещё
        </Button>
      )}
    </main>
  );
}
