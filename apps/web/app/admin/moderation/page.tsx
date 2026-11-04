'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAsk } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Alert, Badge, Card, EmptyState, Skeleton } from '../../../components/ui/Feedback';
import { useApi } from '../../../components/admin/useApi';
import { apiRequest } from '../../../lib/auth-client';
import { formatDate } from '../../../lib/content';
import styles from '../../../components/admin/admin.module.css';

type Kind = 'announcements' | 'jobs' | 'lost-found' | 'posts' | 'groups';

interface Item {
  kind: Kind;
  id: string;
  title: string;
  excerpt: string;
  createdAt: string;
}

const KINDS: Record<Kind, { label: string; history: string }> = {
  announcements: { label: 'Объявления', history: '/admin/moderation/announcements' },
  jobs: { label: 'Вакансии', history: '/admin/community' },
  'lost-found': { label: 'Потеряно и найдено', history: '/admin/community' },
  posts: { label: 'Посты', history: '/admin/social' },
  groups: { label: 'Группы', history: '/admin/social' },
};
const PER_KIND = 50;
const keyOf = (i: Pick<Item, 'kind' | 'id'>) => `${i.kind}:${i.id}`;

export default function ModerationQueuePage() {
  const { data, error, reload } = useApi<{
    counts: Partial<Record<Kind, number>>;
    items: Item[];
  }>('/api/moderation/queue');
  const [filter, setFilter] = useState<Kind | 'all'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string }>();
  const [dialog, ask] = useAsk();

  const kinds = data ? (Object.keys(data.counts) as Kind[]) : [];
  const total = kinds.reduce((n, k) => n + (data?.counts[k] ?? 0), 0);
  const items = data?.items.filter((i) => filter === 'all' || i.kind === filter) ?? [];
  const chosen = items.filter((i) => selected.has(keyOf(i)));
  const allChosen = items.length > 0 && chosen.length === items.length;

  function toggle(item: Item) {
    const next = new Set(selected);
    if (next.has(keyOf(item))) next.delete(keyOf(item));
    else next.add(keyOf(item));
    setSelected(next);
  }

  async function decide(list: Item[], decision: 'approve' | 'reject') {
    if (list.length === 0) return;
    let note: string | undefined;
    if (decision === 'reject') {
      note = (
        await ask({
          title: list.length === 1 ? 'Отклонить публикацию?' : `Отклонить ${list.length} шт.?`,
          description: list.length > 1 ? 'Причина будет одинаковой для всех авторов.' : undefined,
          field: 'Причина (увидит автор)',
          confirmLabel: 'Отклонить',
          danger: true,
        })
      )?.trim();
      if (!note) return;
    }
    setBusy(true);
    let ok = 0;
    for (const item of list) {
      const r = await apiRequest(`/api/moderation/${item.kind}/${item.id}/${decision}`, {
        body: note ? { note } : {},
      });
      if (r.ok) ok += 1;
    }
    setBusy(false);
    setSelected(new Set());
    const failed = list.length - ok;
    setMessage(
      failed === 0
        ? {
            tone: 'success',
            text: `${decision === 'approve' ? 'Одобрено' : 'Отклонено'}: ${ok}.`,
          }
        : {
            tone: 'error',
            text: `Сохранено: ${ok}, не удалось: ${failed}. Возможно, публикацию уже обработал другой модератор.`,
          },
    );
    reload();
  }

  return (
    <>
      {dialog}
      <div className={styles.head}>
        <h1>Очередь модерации</h1>
        <p className={styles.muted}>
          Всё, что ждёт решения, в одном списке: сначала самые давние. Автор получит уведомление о
          решении.
        </p>
      </div>
      {error && <Alert tone="error" title={error} />}
      {!data && !error && <Skeleton height="10rem" />}
      {data && (
        <>
          <div className={styles.counters} role="group" aria-label="Разделы очереди">
            <button
              type="button"
              className={`${styles.counter} ${styles.counterButton}`}
              aria-pressed={filter === 'all'}
              onClick={() => setFilter('all')}
            >
              <Card>
                <span className={styles.counterValue}>{total}</span>
                <span className={styles.muted}>Всего на проверке</span>
              </Card>
            </button>
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                className={`${styles.counter} ${styles.counterButton}`}
                aria-pressed={filter === k}
                onClick={() => setFilter(k)}
              >
                <Card>
                  <span className={styles.counterValue}>{data.counts[k]}</span>
                  <span className={styles.muted}>{KINDS[k].label}</span>
                </Card>
              </button>
            ))}
          </div>
          {kinds.some((k) => (data.counts[k] ?? 0) > PER_KIND) && (
            <Alert
              tone="info"
              title={`Показаны первые ${PER_KIND} публикаций каждого раздела. Остальные появятся после обработки.`}
            />
          )}
          {message && <Alert tone={message.tone} title={message.text} />}
          {items.length === 0 ? (
            <EmptyState title="Очередь пуста" description="Новых публикаций на проверке нет." />
          ) : (
            <>
              <div className={styles.toolbar}>
                <label className={styles.actions}>
                  <input
                    type="checkbox"
                    checked={allChosen}
                    onChange={() =>
                      setSelected(allChosen ? new Set() : new Set(items.map((i) => keyOf(i))))
                    }
                  />
                  <span>Выбрать все ({items.length})</span>
                </label>
                <Button
                  size="sm"
                  disabled={busy || chosen.length === 0}
                  onClick={() => void decide(chosen, 'approve')}
                >
                  Одобрить выбранные ({chosen.length})
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy || chosen.length === 0}
                  onClick={() => void decide(chosen, 'reject')}
                >
                  Отклонить выбранные
                </Button>
              </div>
              {items.map((item) => (
                <Card key={keyOf(item)} className={styles.item}>
                  <div className={styles.actions}>
                    <input
                      type="checkbox"
                      aria-label={`Выбрать «${item.title}»`}
                      checked={selected.has(keyOf(item))}
                      onChange={() => toggle(item)}
                    />
                    <Badge>{KINDS[item.kind].label}</Badge>
                    <span className={styles.muted}>{formatDate(item.createdAt, true)}</span>
                  </div>
                  <h2>{item.title}</h2>
                  {item.excerpt && <p className={styles.pre}>{item.excerpt}</p>}
                  <div className={styles.actions}>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => void decide([item], 'approve')}
                    >
                      Одобрить
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void decide([item], 'reject')}
                    >
                      Отклонить
                    </Button>
                    <Link href={KINDS[item.kind].history} className={styles.muted}>
                      Подробнее в разделе
                    </Link>
                  </div>
                </Card>
              ))}
            </>
          )}
        </>
      )}
    </>
  );
}
