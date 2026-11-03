'use client';

import { useAsk } from '../../../components/ui/Dialog';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Alert, Badge, Card, EmptyState, Skeleton } from '../../../components/ui/Feedback';
import { Select } from '../../../components/ui/Field';
import { useApi } from '../../../components/admin/useApi';
import { apiRequest, errorMessage } from '../../../lib/auth-client';
import { LF_KIND, LF_SUBJECT } from '../../../lib/community';
import { formatDate } from '../../../lib/content';
import styles from '../../../components/admin/admin.module.css';

interface Item {
  id: string;
  slug: string;
  title: string;
  description: string;
  employer?: string;
  kind?: 'lost' | 'found';
  subject?: 'item' | 'animal';
  area: string | null;
  contactPhone: string | null;
  imageIds?: string[];
  status: string;
  moderationNote: string | null;
  createdAt: string;
}

export default function CommunityModerationPage() {
  const [section, setSection] = useState<'jobs' | 'lost-found'>('jobs');
  const [status, setStatus] = useState('pending');
  const { data, error, reload } = useApi<Item[]>(`/api/moderation/${section}?status=${status}`);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string }>();
  const [dialog, ask] = useAsk();

  async function decide(item: Item, decision: 'approve' | 'reject' | 'unpublish') {
    let note: string | undefined;
    if (decision !== 'approve') {
      note = (
        await ask({
          title: decision === 'reject' ? 'Отклонить публикацию?' : 'Снять с публикации?',
          field: 'Причина (увидит автор)',
          confirmLabel: 'Сохранить решение',
          danger: true,
        })
      )?.trim();
      if (!note) return;
    }
    const r = await apiRequest(`/api/moderation/${section}/${item.id}/${decision}`, {
      body: note ? { note } : {},
    });
    setMessage(
      r.ok
        ? { tone: 'success', text: `«${item.title}»: решение сохранено.` }
        : { tone: 'error', text: errorMessage(r) },
    );
    reload();
  }

  return (
    <>
      {dialog}
      <div className={styles.head}>
        <h1>Вакансии и находки</h1>
      </div>
      <div className={styles.toolbar}>
        <Select
          label="Раздел"
          value={section}
          onChange={(e) => setSection(e.target.value as typeof section)}
        >
          <option value="jobs">Вакансии</option>
          <option value="lost-found">Потеряно и найдено</option>
        </Select>
        <Select label="Статус" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">На проверке</option>
          <option value="published">Опубликованные</option>
          <option value="rejected">Отклонённые</option>
        </Select>
      </div>
      {message && <Alert tone={message.tone} title={message.text} />}
      {error && <Alert tone="error" title={error} />}
      {!data && !error && <Skeleton height="10rem" />}
      {data?.length === 0 && (
        <EmptyState title="Очередь пуста" description="Публикаций с этим статусом нет." />
      )}
      {data?.map((item) => (
        <Card key={item.id} className={styles.item}>
          <div className={styles.actions}>
            {item.kind && <Badge>{LF_KIND[item.kind]}</Badge>}
            {item.subject && <Badge>{LF_SUBJECT[item.subject]}</Badge>}
            {item.employer && <Badge>{item.employer}</Badge>}
            <span className={styles.muted}>{formatDate(item.createdAt, true)}</span>
          </div>
          <h2>
            {item.status === 'published' ? (
              <Link href={`/${section}/${item.slug}`}>{item.title}</Link>
            ) : (
              item.title
            )}
          </h2>
          <p className={styles.pre}>{item.description}</p>
          {(item.area || item.contactPhone) && (
            <p className={styles.muted}>
              {[item.area, item.contactPhone].filter(Boolean).join(' · ')}
            </p>
          )}
          {item.imageIds && item.imageIds.length > 0 && (
            <div className={styles.thumbs}>
              {item.imageIds.map((id) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={id} src={`/api/media/${id}`} alt="" />
              ))}
            </div>
          )}
          {item.moderationNote && <p className={styles.muted}>Причина: {item.moderationNote}</p>}
          <div className={styles.actions}>
            {item.status === 'pending' && (
              <>
                <Button size="sm" onClick={() => void decide(item, 'approve')}>
                  Одобрить
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void decide(item, 'reject')}>
                  Отклонить
                </Button>
              </>
            )}
            {item.status === 'published' && (
              <Button size="sm" variant="secondary" onClick={() => void decide(item, 'unpublish')}>
                Снять с публикации
              </Button>
            )}
          </div>
        </Card>
      ))}
    </>
  );
}
