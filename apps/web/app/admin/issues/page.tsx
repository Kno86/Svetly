'use client';

import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Alert, Badge, Card, EmptyState, Skeleton } from '../../../components/ui/Feedback';
import { Checkbox, Select, TextArea } from '../../../components/ui/Field';
import { useApi } from '../../../components/admin/useApi';
import { useCan } from '../../../components/admin/AdminShell';
import { apiRequest, errorMessage } from '../../../lib/auth-client';
import { ISSUE_CATEGORIES, ISSUE_PRIORITY, ISSUE_STATUS } from '../../../lib/community';
import { formatDate } from '../../../lib/content';
import styles from '../../../components/admin/admin.module.css';

interface Issue {
  id: string;
  number: number;
  category: string;
  title: string;
  description: string;
  address: string | null;
  imageIds: string[];
  isPublic: boolean;
  contact: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  createdAt: string;
}
interface Update {
  id: string;
  kind: string;
  toStatus: string | null;
  body: string;
  internal: boolean;
  createdAt: string;
}

function IssueCard({ issue, onChange }: { issue: Issue; onChange: () => void }) {
  const canRespond = useCan('issues.respond');
  const [open, setOpen] = useState(false);
  const detail = useApi<Issue & { updates: Update[] }>(
    open ? `/api/admin/issues/${issue.id}` : null,
  );
  const [status, setStatus] = useState(issue.status);
  const [priority, setPriority] = useState(issue.priority);
  const [note, setNote] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string }>();

  async function save() {
    const r = await apiRequest(`/api/admin/issues/${issue.id}`, {
      method: 'PATCH',
      body: { status, priority, ...(note.trim() ? { note: note.trim() } : {}) },
    });
    setMessage(
      r.ok ? { tone: 'success', text: 'Сохранено' } : { tone: 'error', text: errorMessage(r) },
    );
    if (r.ok) {
      setNote('');
      detail.reload();
      onChange();
    }
  }
  async function comment() {
    const r = await apiRequest(`/api/admin/issues/${issue.id}/comments`, {
      body: { body: note.trim(), public: isPublic },
    });
    setMessage(
      r.ok
        ? { tone: 'success', text: isPublic ? 'Ответ опубликован' : 'Заметка добавлена' }
        : { tone: 'error', text: errorMessage(r) },
    );
    if (r.ok) {
      setNote('');
      detail.reload();
    }
  }

  return (
    <Card className={styles.item}>
      <div className={styles.actions}>
        <Badge tone={ISSUE_STATUS[issue.status]?.tone}>{ISSUE_STATUS[issue.status]?.label}</Badge>
        <Badge>{ISSUE_CATEGORIES[issue.category]}</Badge>
        <Badge tone={issue.priority === 'high' ? 'error' : 'neutral'}>
          Приоритет: {ISSUE_PRIORITY[issue.priority]}
        </Badge>
        <span className={styles.muted}>{issue.isPublic ? 'публичное' : 'приватное'}</span>
        <span className={styles.muted}>{formatDate(issue.createdAt, true)}</span>
      </div>
      <h2>
        № {issue.number}. {issue.title}
      </h2>
      <p className={styles.pre}>{issue.description}</p>
      {(issue.address || issue.contact) && (
        <p className={styles.muted}>
          {[issue.address, issue.contact && `Контакт: ${issue.contact}`]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
      {issue.imageIds.length > 0 && (
        <div className={styles.thumbs}>
          {issue.imageIds.map((id) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={id} src={`/api/media/${id}`} alt="" />
          ))}
        </div>
      )}
      <Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)}>
        {open ? 'Свернуть' : 'Работать с обращением'}
      </Button>
      {open && (
        <div className={styles.form}>
          {message && <Alert tone={message.tone} title={message.text} />}
          <ol>
            {detail.data?.updates.map((u) => (
              <li key={u.id} className={styles.muted}>
                {formatDate(u.createdAt, true)} · {u.internal ? 'внутреннее' : 'видно жителю'} ·{' '}
                {u.kind}
                {u.toStatus && ` → ${ISSUE_STATUS[u.toStatus]?.label}`} {u.body && `: ${u.body}`}
              </li>
            ))}
          </ol>
          <div className={styles.toolbar}>
            <Select label="Статус" value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(ISSUE_STATUS).map(([v, s]) => (
                <option key={v} value={v}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Select
              label="Приоритет"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              {Object.entries(ISSUE_PRIORITY).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <TextArea
            label="Комментарий"
            hint="При смене статуса виден жителю. Для «Отклонено» обязателен."
            rows={3}
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {canRespond && (
            <Checkbox
              label="Опубликовать как ответ платформы (увидит житель)"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
          )}
          <div className={styles.actions}>
            <Button size="sm" onClick={() => void save()}>
              Сохранить статус
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={note.trim().length < 2}
              onClick={() => void comment()}
            >
              {isPublic ? 'Ответить' : 'Добавить заметку'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function AdminIssuesPage() {
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [mine, setMine] = useState(false);
  const qs = new URLSearchParams({
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
    ...(mine ? { mine: '1' } : {}),
  });
  const { data, error, reload } = useApi<Issue[]>(`/api/admin/issues?${qs.toString()}`);
  return (
    <>
      <div className={styles.head}>
        <h1>Обращения жителей</h1>
      </div>
      <div className={styles.toolbar}>
        <Select label="Статус" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Открытые</option>
          {Object.entries(ISSUE_STATUS).map(([v, s]) => (
            <option key={v} value={v}>
              {s.label}
            </option>
          ))}
        </Select>
        <Select label="Категория" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Все</option>
          {Object.entries(ISSUE_CATEGORIES).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Checkbox
          label="Только назначенные мне"
          checked={mine}
          onChange={(e) => setMine(e.target.checked)}
        />
      </div>
      {error && <Alert tone="error" title={error} />}
      {!data && !error && <Skeleton height="10rem" />}
      {data?.length === 0 && (
        <EmptyState title="Обращений нет" description="По выбранным фильтрам ничего не найдено." />
      )}
      {data?.map((i) => (
        <IssueCard key={i.id} issue={i} onChange={reload} />
      ))}
    </>
  );
}
