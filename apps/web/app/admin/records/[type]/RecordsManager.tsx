'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useAsk } from '../../../../components/ui/Dialog';
import { Button } from '../../../../components/ui/Button';
import { Alert, Badge, Card, EmptyState, Skeleton } from '../../../../components/ui/Feedback';
import { Select, TextArea, TextField } from '../../../../components/ui/Field';
import { ImageUploader } from '../../../../components/ui/ImageUploader';
import { useApi } from '../../../../components/admin/useApi';
import { apiRequest, errorMessage } from '../../../../lib/auth-client';
import { RECORD_TYPES, STATUS_LABELS } from '../../../../lib/admin';
import { formatDate } from '../../../../lib/content';
import styles from '../../../../components/admin/admin.module.css';

interface RecordRow {
  id: string;
  title: string;
  text: string;
  status: string;
  imageIds: string[];
  updatedAt: string;
  href: string;
  authorName: string | null;
}

interface RecordPage {
  total: number;
  page: number;
  pageSize: number;
  statuses: string[];
  hasTitle: boolean;
  items: RecordRow[];
}

const label = (status: string) => STATUS_LABELS[status] ?? status;
const tone = (status: string) =>
  status === 'published' || status === 'active' || status === 'resolved'
    ? 'success'
    : status === 'pending'
      ? 'warning'
      : 'neutral';

export function RecordsManager({ type }: { type: string }) {
  const meta = RECORD_TYPES[type]!;
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page) });
  if (query.trim()) params.set('q', query.trim());
  if (status) params.set('status', status);
  const list = useApi<RecordPage>(`/api/staff/records/${type}?${params}`);
  const [editing, setEditing] = useState<RecordRow>();
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string }>();
  const [dialog, ask] = useAsk();

  async function remove(row: RecordRow) {
    const ok = await ask({
      title: `Удалить «${row.title}»?`,
      description: 'Запись удалится безвозвратно. Чтобы только скрыть её, смените статус.',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (ok === undefined) return;
    const r = await apiRequest(`/api/staff/records/${type}/${row.id}`, { method: 'DELETE' });
    setMessage(
      r.ok
        ? { tone: 'success', text: 'Запись удалена.' }
        : { tone: 'error', text: errorMessage(r) },
    );
    list.reload();
  }

  if (editing && list.data)
    return (
      <RecordEditor
        type={type}
        row={editing}
        statuses={list.data.statuses}
        hasTitle={list.data.hasTitle}
        onDone={(text) => {
          setEditing(undefined);
          if (text) setMessage({ tone: 'success', text });
          list.reload();
        }}
      />
    );

  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;

  return (
    <>
      {dialog}
      <div className={styles.head}>
        <h1>{meta.label}: все записи</h1>
      </div>
      <p>
        Записи жителей в любом статусе. Здесь можно исправить текст и фото, сменить статус или
        удалить запись. Все действия попадают в журнал аудита.
      </p>
      {message && <Alert tone={message.tone} title={message.text} />}
      <div className={styles.toolbar}>
        <TextField
          label="Поиск"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
        <Select
          label="Статус"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Все</option>
          {list.data?.statuses.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </Select>
      </div>
      {list.error && <Alert tone="error" title={list.error} />}
      {list.loading && <Skeleton height="10rem" />}
      {list.data?.items.length === 0 && (
        <EmptyState title="Записей нет" description="Измените поиск или фильтр." />
      )}
      {list.data && list.data.items.length > 0 && (
        <ul className={styles.recordList} aria-label="Записи">
          {list.data.items.map((row) => (
            <li key={row.id}>
              <Card>
                <p className={styles.recordTitle}>
                  {row.status === 'published' || row.status === 'active' ? (
                    <Link href={row.href}>{row.title}</Link>
                  ) : (
                    row.title
                  )}
                </p>
                <p>
                  <Badge tone={tone(row.status)}>{label(row.status)}</Badge>{' '}
                  <small>
                    {row.authorName ?? 'Без автора'} · {formatDate(row.updatedAt, true)}
                    {row.imageIds.length > 0 ? ` · фото: ${row.imageIds.length}` : ''}
                  </small>
                </p>
                <div className={styles.actions}>
                  <Button size="sm" variant="secondary" onClick={() => setEditing(row)}>
                    Изменить
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void remove(row)}>
                    Удалить
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <div className={styles.actions}>
          <Button
            size="sm"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Назад
          </Button>
          <span>
            Страница {page} из {pages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            Дальше
          </Button>
        </div>
      )}
    </>
  );
}

function RecordEditor({
  type,
  row,
  statuses,
  hasTitle,
  onDone,
}: {
  type: string;
  row: RecordRow;
  statuses: string[];
  hasTitle: boolean;
  onDone: (message?: string) => void;
}) {
  const [title, setTitle] = useState(row.title);
  const [text, setText] = useState(row.text);
  const [status, setStatus] = useState(row.status);
  const [imageIds, setImageIds] = useState(row.imageIds);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const r = await apiRequest(`/api/staff/records/${type}/${row.id}`, {
      method: 'PATCH',
      body: { ...(hasTitle ? { title } : {}), text, status, imageIds },
    });
    setSaving(false);
    if (r.ok) onDone('Изменения сохранены.');
    else setError(errorMessage(r));
  }

  return (
    <form onSubmit={(e) => void submit(e)} className={styles.form}>
      <div className={styles.head}>
        <h1>Редактирование</h1>
      </div>
      {error && <Alert tone="error" title={error} />}
      {hasTitle && (
        <TextField
          label="Заголовок"
          value={title}
          required
          minLength={2}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
        />
      )}
      <TextArea
        label="Текст"
        value={text}
        required
        rows={8}
        onChange={(e) => setText(e.target.value)}
      />
      <Select label="Статус" value={status} onChange={(e) => setStatus(e.target.value)}>
        {statuses.map((s) => (
          <option key={s} value={s}>
            {label(s)}
          </option>
        ))}
      </Select>
      <ImageUploader
        label="Фото"
        hint="Первое фото — превью в списках."
        value={imageIds}
        onChange={setImageIds}
      />
      <div className={styles.actions}>
        <Button type="submit" disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => onDone()}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
