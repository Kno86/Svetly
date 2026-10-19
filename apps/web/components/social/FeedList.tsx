'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { EmptyState, Skeleton } from '../ui/Feedback';
import { apiRequest, errorMessage } from '../../lib/auth-client';
import { mergePages, type FeedPage, type FeedPost } from '../../lib/social';
import { PostCard } from './PostCard';
import styles from './social.module.css';

/** Paged feed with an explicit «Показать ещё» button (no unbounded infinite scroll). */
export function FeedList({
  path,
  signedIn,
  empty,
  version = 0,
}: {
  path: string;
  signedIn: boolean;
  empty: { title: string; description: string };
  version?: number;
}) {
  const [items, setItems] = useState<FeedPost[]>();
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const sep = path.includes('?') ? '&' : '?';

  const load = useCallback(
    async (after?: string) => {
      setBusy(true);
      const r = await apiRequest<FeedPage>(after ? `${path}${sep}cursor=${after}` : path);
      setBusy(false);
      if (!r.ok || !r.data) return setError(errorMessage(r));
      const page = r.data;
      setError(undefined);
      setItems((cur) => (after && cur ? mergePages(cur, page.items) : page.items));
      setCursor(page.nextCursor);
    },
    [path, sep],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, version]);

  if (error && !items) return <EmptyState title="Не удалось загрузить ленту" description={error} />;
  if (!items) return <Skeleton height="8rem" />;
  if (!items.length) return <EmptyState title={empty.title} description={empty.description} />;
  return (
    <div className={styles.list}>
      {items.map((p) => (
        <PostCard key={p.id} post={p} signedIn={signedIn} />
      ))}
      {error && <p role="alert">{error}</p>}
      <div className={styles.actions}>
        {cursor && (
          <Button variant="secondary" loading={busy} onClick={() => void load(cursor)}>
            Показать ещё
          </Button>
        )}
        <Button variant="ghost" loading={busy} onClick={() => void load()}>
          Обновить
        </Button>
      </div>
    </div>
  );
}
