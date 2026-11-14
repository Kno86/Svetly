'use client';

import { useState, type ChangeEvent } from 'react';
import { useAsk } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Alert, Badge, Card, EmptyState, Skeleton } from '../../../components/ui/Feedback';
import { Checkbox, TextField } from '../../../components/ui/Field';
import { MediaImage } from '../../../components/content/MediaImage';
import { checkImage } from '../../../components/content/AnnouncementForm';
import { useApi } from '../../../components/admin/useApi';
import { apiRequest, errorMessage } from '../../../lib/auth-client';
import { formatDate } from '../../../lib/content';
import styles from '../../../components/admin/admin.module.css';

interface MediaItem {
  id: string;
  alt: string;
  mime: string;
  size: number;
  createdAt: string;
  ownerName: string | null;
  usage: number;
}

interface MediaPage {
  total: number;
  page: number;
  pageSize: number;
  items: MediaItem[];
}

export default function MediaLibraryPage() {
  const [query, setQuery] = useState('');
  const [unused, setUnused] = useState(false);
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page) });
  if (query.trim()) params.set('q', query.trim());
  if (unused) params.set('unused', '1');
  const list = useApi<MediaPage>(`/api/staff/media?${params}`);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);
  const [dialog, ask] = useAsk();

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    setBusy(true);
    let done = 0;
    for (const file of files) {
      const problem = checkImage(file);
      if (problem) {
        setMessage({ tone: 'error', text: `${file.name}: ${problem}` });
        continue;
      }
      const r = await apiRequest('/api/media', { file });
      if (!r.ok) setMessage({ tone: 'error', text: errorMessage(r) });
      else done++;
    }
    setBusy(false);
    if (done) setMessage({ tone: 'success', text: `Загружено фото: ${done}.` });
    list.reload();
  }

  async function editAlt(item: MediaItem) {
    const alt = await ask({
      title: 'Подпись к фото',
      description: 'Коротко опишите, что на фото: подпись читают незрячие посетители.',
      field: 'Подпись',
      defaultValue: item.alt,
      confirmLabel: 'Сохранить',
    });
    if (alt === undefined) return;
    const r = await apiRequest(`/api/staff/media/${item.id}`, { method: 'PATCH', body: { alt } });
    setMessage(
      r.ok
        ? { tone: 'success', text: 'Подпись сохранена.' }
        : { tone: 'error', text: errorMessage(r) },
    );
    list.reload();
  }

  async function remove(item: MediaItem) {
    const ok = await ask({
      title: 'Удалить фото?',
      description: 'Файл удалится безвозвратно.',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (ok === undefined) return;
    const r = await apiRequest(`/api/staff/media/${item.id}`, { method: 'DELETE' });
    setMessage(
      r.ok ? { tone: 'success', text: 'Фото удалено.' } : { tone: 'error', text: errorMessage(r) },
    );
    list.reload();
  }

  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;

  return (
    <>
      {dialog}
      <div className={styles.head}>
        <h1>Медиатека</h1>
        <label className={styles.uploadButton}>
          {busy ? 'Загрузка…' : 'Загрузить фото'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={busy}
            onChange={(e) => void upload(e)}
            className="visually-hidden"
          />
        </label>
      </div>
      <p>
        Все публичные фото сайта. Фото, которое используется в записях или как аватарка, удалить
        нельзя — сначала уберите его из записи. Вложения личных сообщений здесь не показываются.
      </p>
      {message && <Alert tone={message.tone} title={message.text} />}
      <div className={styles.toolbar}>
        <TextField
          label="Поиск по подписи"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
        <Checkbox
          label="Только неиспользуемые"
          checked={unused}
          onChange={(e) => {
            setUnused(e.target.checked);
            setPage(1);
          }}
        />
      </div>
      {list.error && <Alert tone="error" title={list.error} />}
      {list.loading && <Skeleton height="12rem" />}
      {list.data?.items.length === 0 && (
        <EmptyState
          title="Фото не найдено"
          description="Загрузите фото здесь или в форме любой записи."
        />
      )}
      {list.data && list.data.items.length > 0 && (
        <ul className={styles.mediaGrid} aria-label="Фото">
          {list.data.items.map((item) => (
            <li key={item.id}>
              <Card>
                <MediaImage
                  id={item.id}
                  alt={item.alt}
                  variant="card"
                  className={styles.mediaThumb}
                />
                <p>{item.alt || <em>Без подписи</em>}</p>
                <p>
                  <Badge tone={item.usage > 0 ? 'success' : 'neutral'}>
                    {item.usage > 0 ? `Используется: ${item.usage}` : 'Не используется'}
                  </Badge>
                </p>
                <p>
                  <small>
                    {Math.round(item.size / 1024)} КБ · {formatDate(item.createdAt, true)}
                    {item.ownerName ? ` · ${item.ownerName}` : ''}
                  </small>
                </p>
                <div className={styles.actions}>
                  <Button size="sm" variant="secondary" onClick={() => void editAlt(item)}>
                    Подпись
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={item.usage > 0}
                    onClick={() => void remove(item)}
                  >
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
