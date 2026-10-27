'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PageHead, styles } from '../../../components/content/Blocks';
import { Button, ButtonLink } from '../../../components/ui/Button';
import { Alert, Badge, EmptyState, Skeleton } from '../../../components/ui/Feedback';
import { apiRequest, errorMessage } from '../../../lib/auth-client';
import { formatDate } from '../../../lib/content';

interface Interest {
  id: string;
  module: string;
  name: string;
  selected: boolean;
}
interface Reco {
  type: 'news' | 'announcement' | 'event';
  id: string;
  slug: string;
  title: string;
  date: string;
  reasons: string[];
}
const PATHS = { news: '/news', announcement: '/announcements', event: '/events' } as const;
const TYPE_LABEL = { news: 'Новость', announcement: 'Объявление', event: 'Событие' } as const;
const MODULES: Record<string, string> = {
  news: 'Новости',
  announcements: 'Объявления',
  events: 'События',
  organizations: 'Организации',
};

export function RecommendationsView() {
  const [state, setState] = useState<'ok' | 'auth' | 'error'>('ok');
  const [interests, setInterests] = useState<Interest[]>();
  const [recos, setRecos] = useState<{ items: Reco[]; hidden: number }>();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    const [i, r] = await Promise.all([
      apiRequest<{ categories: Interest[] }>('/api/me/interests'),
      apiRequest<{ items: Reco[]; hidden: number }>('/api/me/recommendations'),
    ]);
    if (i.status === 401) return setState('auth');
    if (!i.ok || !r.ok || !i.data || !r.data) return setState('error');
    setState('ok');
    setInterests(i.data.categories);
    setRecos(r.data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function save(next: Interest[]) {
    setInterests(next);
    const r = await apiRequest('/api/me/interests', {
      method: 'PUT',
      body: { categoryIds: next.filter((c) => c.selected).map((c) => c.id) },
    });
    if (!r.ok) return setError(errorMessage(r));
    await load();
  }

  async function hide(item: Reco) {
    const r = await apiRequest('/api/me/recommendations/hidden', {
      body: { entityType: item.type, entityId: item.id },
    });
    if (!r.ok) return setError(errorMessage(r));
    setRecos(
      (cur) => cur && { items: cur.items.filter((x) => x.id !== item.id), hidden: cur.hidden + 1 },
    );
  }

  async function restore() {
    const r = await apiRequest('/api/me/recommendations/hidden', { method: 'DELETE' });
    if (!r.ok) return setError(errorMessage(r));
    await load();
  }

  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Рекомендации"
        description="Подборка строится по простым правилам: выбранные вами категории, свежесть публикации и ближайшие события. Под каждой записью указано, почему она показана. История просмотров не используется."
        crumbs={[{ label: 'Кабинет', href: '/account' }, { label: 'Рекомендации' }]}
      />
      {error && <Alert tone="error" title={error} />}
      {state === 'auth' ? (
        <EmptyState
          title="Войдите, чтобы настроить рекомендации"
          action={<ButtonLink href="/login">Войти</ButtonLink>}
        />
      ) : state === 'error' ? (
        <Alert tone="error" title="Не удалось загрузить рекомендации">
          <Button size="sm" variant="secondary" onClick={() => void load()}>
            Повторить
          </Button>
        </Alert>
      ) : !interests || !recos ? (
        <Skeleton height="10rem" />
      ) : (
        <>
          <section aria-labelledby="interests">
            <h2 id="interests">Мои интересы</h2>
            {!interests.length ? (
              <p>Категорий пока нет — их создаёт редакция.</p>
            ) : (
              Object.entries(MODULES).map(([m, label]) => {
                const list = interests.filter((c) => c.module === m);
                if (!list.length) return null;
                return (
                  <fieldset key={m}>
                    <legend>{label}</legend>
                    {list.map((c) => (
                      <label
                        key={c.id}
                        style={{
                          display: 'inline-flex',
                          gap: 'var(--space-2)',
                          marginInlineEnd: 'var(--space-4)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={c.selected}
                          onChange={(e) =>
                            void save(
                              interests.map((x) =>
                                x.id === c.id ? { ...x, selected: e.target.checked } : x,
                              ),
                            )
                          }
                        />
                        {c.name}
                      </label>
                    ))}
                  </fieldset>
                );
              })
            )}
          </section>
          <section aria-labelledby="for-you">
            <h2 id="for-you">Для вас</h2>
            {recos.hidden > 0 && (
              <p>
                Скрыто записей: {recos.hidden}.{' '}
                <Button size="sm" variant="ghost" onClick={() => void restore()}>
                  Показать снова
                </Button>
              </p>
            )}
            {!recos.items.length ? (
              <EmptyState
                title="Пока нечего рекомендовать"
                description="Здесь появятся свежие новости, объявления и ближайшие события. Выберите интересы, чтобы подборка была точнее."
              />
            ) : (
              <ul style={{ display: 'grid', gap: 'var(--space-4)', padding: 0, listStyle: 'none' }}>
                {recos.items.map((r) => (
                  <li key={`${r.type}:${r.id}`}>
                    <Badge>{TYPE_LABEL[r.type]}</Badge>{' '}
                    <Link href={`${PATHS[r.type]}/${r.slug}`}>
                      <strong>{r.title}</strong>
                    </Link>{' '}
                    <span>{formatDate(r.date, r.type === 'event')}</span>
                    <div>Почему показано: {r.reasons.join('; ')}</div>
                    <Button size="sm" variant="ghost" onClick={() => void hide(r)}>
                      Не показывать
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
