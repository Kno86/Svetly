'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PageHead, styles } from '../../components/content/Blocks';
import { Button } from '../../components/ui/Button';
import { Card, EmptyState, Skeleton } from '../../components/ui/Feedback';
import { COMPLAINT_TARGETS } from '../../lib/admin';
import { apiRequest } from '../../lib/auth-client';
import { formatDate } from '../../lib/content';

interface Favorite {
  entityType: string;
  entityId: string;
  createdAt: string;
  available: boolean;
  title: string | null;
  href: string | null;
}

export default function FavoritesPage() {
  const [items, setItems] = useState<Favorite[] | null>();
  const load = useCallback(async () => {
    const r = await apiRequest<Favorite[]>('/api/me/favorites');
    setItems(r.ok && r.data ? r.data : null);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function remove(f: Favorite) {
    await apiRequest(`/api/favorites/${f.entityType}/${f.entityId}`, { method: 'DELETE' });
    await load();
  }

  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Избранное"
        description="Сохранённые материалы видите только вы."
        crumbs={[{ label: 'Кабинет', href: '/account' }, { label: 'Избранное' }]}
      />
      {items === undefined ? (
        <Skeleton height="6rem" />
      ) : items === null ? (
        <EmptyState
          title="Нужен вход"
          description="Войдите, чтобы видеть избранное."
          action={<Link href="/login?next=/favorites">Войти</Link>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="В избранном пусто"
          description="Нажмите «В избранное» на странице объявления, события, организации или поста."
        />
      ) : (
        <div className={styles.list}>
          {items.map((f) => (
            <Card key={`${f.entityType}:${f.entityId}`}>
              <p>
                {COMPLAINT_TARGETS[f.entityType]?.label ?? f.entityType} · сохранено{' '}
                {formatDate(f.createdAt)}
              </p>
              {f.available && f.href ? (
                <h2>
                  <Link href={f.href}>{f.title}</Link>
                </h2>
              ) : (
                <p>Материал снят с публикации, истёк или больше недоступен.</p>
              )}
              <Button size="sm" variant="ghost" onClick={() => void remove(f)}>
                Убрать
              </Button>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
