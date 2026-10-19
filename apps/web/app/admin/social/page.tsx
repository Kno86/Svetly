'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Alert, Badge, Card, EmptyState, Skeleton } from '../../../components/ui/Feedback';
import { Select } from '../../../components/ui/Field';
import { useApi } from '../../../components/admin/useApi';
import { apiRequest, errorMessage } from '../../../lib/auth-client';
import { formatDate } from '../../../lib/content';
import { GROUP_TOPICS } from '../../../lib/social';
import styles from '../../../components/admin/admin.module.css';
import social from '../../../components/social/social.module.css';

interface Item {
  id: string;
  slug?: string;
  name?: string;
  description?: string;
  rules?: string;
  topic?: string;
  visibility?: string;
  body?: string;
  link?: string | null;
  imageIds?: string[];
  author?: { name: string };
  group?: { slug: string; name: string } | null;
  status: string;
  moderationNote: string | null;
  createdAt: string;
}

const STATUSES = {
  posts: [
    ['pending', 'На проверке'],
    ['published', 'Опубликованы'],
    ['rejected', 'Отклонены'],
    ['removed', 'Сняты'],
  ],
  groups: [
    ['pending', 'На проверке'],
    ['active', 'Активные'],
    ['rejected', 'Отклонены'],
  ],
} as const;

export default function SocialModerationPage() {
  const [section, setSection] = useState<'posts' | 'groups'>('posts');
  const [status, setStatus] = useState('pending');
  const { data, error, reload } = useApi<Item[]>(`/api/moderation/${section}?status=${status}`);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string }>();

  async function decide(item: Item, decision: 'approve' | 'reject' | 'archive') {
    let note: string | undefined;
    if (decision !== 'approve') {
      note = window.prompt('Причина (увидит автор):')?.trim();
      if (!note) return;
    }
    const r = await apiRequest(`/api/moderation/${section}/${item.id}/${decision}`, {
      body: note ? { note } : {},
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
      <div className={styles.head}>
        <h1>Лента и группы</h1>
      </div>
      <div className={styles.toolbar}>
        <Select
          label="Раздел"
          value={section}
          onChange={(e) => {
            setSection(e.target.value as 'posts' | 'groups');
            setStatus('pending');
          }}
        >
          <option value="posts">Посты</option>
          <option value="groups">Группы</option>
        </Select>
        <Select label="Статус" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES[section].map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </div>
      {message && <Alert tone={message.tone} title={message.text} />}
      {error ? (
        <Alert tone="error" title={error} />
      ) : !data ? (
        <Skeleton height="8rem" />
      ) : data.length === 0 ? (
        <EmptyState title="Очередь пуста" description="Материалов с таким статусом нет." />
      ) : (
        <div className={social.list}>
          {data.map((item) => (
            <Card key={item.id}>
              {section === 'groups' ? (
                <>
                  <h2>
                    <Link href={`/groups/${item.slug}`}>{item.name}</Link>
                  </h2>
                  <p>
                    <Badge>{GROUP_TOPICS[item.topic ?? ''] ?? item.topic}</Badge>{' '}
                    {item.visibility === 'open' ? 'открытая' : 'закрытая'} ·{' '}
                    {formatDate(item.createdAt)}
                  </p>
                  <p>{item.description}</p>
                  {item.rules && <p>Правила: {item.rules}</p>}
                </>
              ) : (
                <>
                  <p>
                    {item.author?.name} ·{' '}
                    {item.group ? `группа «${item.group.name}»` : 'общая лента'} ·{' '}
                    {formatDate(item.createdAt, true)}
                  </p>
                  <p>{item.body}</p>
                  {item.link && <p>Ссылка: {item.link}</p>}
                  {item.imageIds?.map((id) => (
                    <img key={id} src={`/api/media/${id}`} alt="" />
                  ))}
                  {item.status === 'published' && (
                    <Link href={`/feed/${item.id}`}>Открыть обсуждение</Link>
                  )}
                </>
              )}
              {item.moderationNote && <p>Комментарий: {item.moderationNote}</p>}
              <div className={styles.toolbar}>
                {item.status === 'pending' && (
                  <>
                    <Button size="sm" onClick={() => void decide(item, 'approve')}>
                      Одобрить
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => void decide(item, 'reject')}>
                      Отклонить
                    </Button>
                  </>
                )}
                {section === 'groups' && item.status === 'active' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void decide(item, 'archive')}
                  >
                    В архив
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
