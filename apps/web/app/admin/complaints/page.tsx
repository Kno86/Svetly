'use client';

import { useAsk } from '../../../components/ui/Dialog';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Alert, Badge, Card, EmptyState, Skeleton } from '../../../components/ui/Feedback';
import { Select } from '../../../components/ui/Field';
import { useApi } from '../../../components/admin/useApi';
import { apiRequest, errorMessage } from '../../../lib/auth-client';
import { COMPLAINT_REASONS, COMPLAINT_TARGETS } from '../../../lib/admin';
import { formatDate } from '../../../lib/content';
import styles from '../../../components/admin/admin.module.css';

interface Complaint {
  id: string;
  entityType: string;
  reason: string;
  details: string;
  status: 'open' | 'resolved' | 'dismissed';
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  target: { title: string; slug: string; status: string } | null;
}

export default function ComplaintsPage() {
  const [status, setStatus] = useState('open');
  const { data, error, reload } = useApi<Complaint[]>(`/api/admin/complaints?status=${status}`);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string }>();
  const [dialog, ask] = useAsk();

  async function resolve(c: Complaint, decision: 'resolved' | 'dismissed') {
    const note = (
      await ask({
        title: decision === 'resolved' ? 'Закрыть жалобу как решённую?' : 'Отклонить жалобу?',
        field: decision === 'resolved' ? 'Что сделано' : 'Почему жалоба отклонена',
        confirmLabel: 'Сохранить решение',
      })
    )?.trim();
    if (!note) return;
    const r = await apiRequest(`/api/admin/complaints/${c.id}/resolve`, {
      body: { decision, note },
    });
    setMessage(
      r.ok
        ? { tone: 'success', text: 'Решение сохранено.' }
        : { tone: 'error', text: errorMessage(r) },
    );
    reload();
  }

  return (
    <>
      {dialog}
      <div className={styles.head}>
        <h1>Жалобы</h1>
      </div>
      <div className={styles.toolbar}>
        <Select label="Статус" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="open">Открытые</option>
          <option value="resolved">Решённые</option>
          <option value="dismissed">Отклонённые</option>
        </Select>
      </div>
      <p className={styles.muted}>
        Жалоба не скрывает публикацию автоматически. Чтобы снять объявление, используйте раздел
        «Модерация»; карточки редакции меняются в соответствующем разделе.
      </p>
      {message && <Alert tone={message.tone} title={message.text} />}
      {error && <Alert tone="error" title={error} />}
      {!data && !error && <Skeleton height="10rem" />}
      {data?.length === 0 && <EmptyState title="Жалоб нет" description="Здесь пока пусто." />}
      {data?.map((c) => {
        const t = COMPLAINT_TARGETS[c.entityType];
        return (
          <Card key={c.id} className={styles.item}>
            <div className={styles.actions}>
              <Badge>{t?.label ?? c.entityType}</Badge>
              <Badge tone="warning">{COMPLAINT_REASONS[c.reason] ?? c.reason}</Badge>
              <span className={styles.muted}>{formatDate(c.createdAt, true)}</span>
            </div>
            <h2>
              {c.entityType === 'message' ? (
                <span className={styles.pre}>
                  {c.target?.title || (c.target ? 'Только фото' : 'Сообщение удалено')}
                </span>
              ) : c.target && t && c.target.status === 'published' ? (
                <Link href={`${t.path}/${c.target.slug}`}>{c.target.title}</Link>
              ) : (
                (c.target?.title ?? 'Запись удалена')
              )}
              {c.entityType !== 'message' && c.target && c.target.status !== 'published' && (
                <span className={styles.muted}> (сейчас не опубликовано)</span>
              )}
            </h2>
            {c.details && <p className={styles.pre}>{c.details}</p>}
            {c.resolutionNote && <p className={styles.muted}>Решение: {c.resolutionNote}</p>}
            {c.status === 'open' && (
              <div className={styles.actions}>
                <Button size="sm" onClick={() => void resolve(c, 'resolved')}>
                  Решено
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void resolve(c, 'dismissed')}>
                  Отклонить жалобу
                </Button>
              </div>
            )}
          </Card>
        );
      })}
    </>
  );
}
