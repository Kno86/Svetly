'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button, buttonClass } from '../ui/Button';
import { Alert, Skeleton } from '../ui/Feedback';
import { Select, TextArea, TextField } from '../ui/Field';
import { apiRequest, errorMessage } from '../../lib/auth-client';
import type { Category } from '../../lib/content';
import styles from './content.module.css';

const MAX_IMAGES = 6;
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface AnnouncementDraft {
  title: string;
  description: string;
  categoryId: string;
  price: string;
  condition: '' | 'new' | 'used';
  area: string;
  contactPhone: string;
  imageIds: string[];
}

const EMPTY: AnnouncementDraft = {
  title: '',
  description: '',
  categoryId: '',
  price: '',
  condition: '',
  area: '',
  contactPhone: '',
  imageIds: [],
};

/** Converts form state into the API payload; empty optional fields become null. */
export function toPayload(d: AnnouncementDraft) {
  const price = d.price.trim() === '' ? null : Number(d.price);
  return {
    title: d.title.trim(),
    description: d.description.trim(),
    categoryId: d.categoryId,
    price: price !== null && Number.isFinite(price) ? Math.round(price) : null,
    condition: d.condition || null,
    area: d.area.trim() || null,
    contactPhone: d.contactPhone.trim() || null,
    imageIds: d.imageIds,
  };
}

/** Client-side precheck mirrors server rules; the server stays the source of truth. */
export function checkImage(file: { type: string; size: number }): string | undefined {
  if (!TYPES.includes(file.type)) return 'Подходят только JPEG, PNG или WebP.';
  if (file.size > MAX_BYTES) return 'Файл больше 5 МБ.';
  return undefined;
}

export function AnnouncementForm({ id }: { id?: string }) {
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'anonymous' | 'ready' | 'error'>('loading');
  const [categories, setCategories] = useState<Category[]>([]);
  const [draft, setDraft] = useState<AnnouncementDraft>(EMPTY);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const me = await apiRequest('/api/me');
      if (cancelled) return;
      if (me.status === 401) return setState('anonymous');
      const cats = await apiRequest<Category[]>('/api/categories?module=announcements');
      const existing = id
        ? await apiRequest<
            Omit<AnnouncementDraft, 'price' | 'condition'> & {
              price: number | null;
              condition: 'new' | 'used' | null;
              area: string | null;
              contactPhone: string | null;
            }
          >(`/api/me/announcements/${id}`)
        : undefined;
      if (cancelled) return;
      if (!cats.ok || (existing && !existing.ok)) return setState('error');
      setCategories(cats.data ?? []);
      if (existing?.data) {
        const e = existing.data;
        setDraft({
          title: e.title,
          description: e.description,
          categoryId: e.categoryId,
          price: e.price === null ? '' : String(e.price),
          condition: e.condition ?? '',
          area: e.area ?? '',
          contactPhone: e.contactPhone ?? '',
          imageIds: e.imageIds,
        });
      }
      setState('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const set = <K extends keyof AnnouncementDraft>(key: K, value: AnnouncementDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  async function upload(files: FileList | null) {
    if (!files) return;
    setError(undefined);
    const list = [...files].slice(0, MAX_IMAGES - draft.imageIds.length);
    setUploading(true);
    const added: string[] = [];
    for (const file of list) {
      const problem = checkImage(file);
      if (problem) {
        setError(`${file.name}: ${problem}`);
        continue;
      }
      const r = await apiRequest<{ id: string }>('/api/media', { file });
      if (!r.ok || !r.data) setError(`${file.name}: ${errorMessage(r)}`);
      else added.push(r.data.id);
    }
    setUploading(false);
    setDraft((d) => ({ ...d, imageIds: [...d.imageIds, ...added].slice(0, MAX_IMAGES) }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const r = await apiRequest<{ slug: string; status: string }>(
      id ? `/api/announcements/${id}` : '/api/announcements',
      {
        method: id ? 'PATCH' : 'POST',
        body: toPayload(draft),
      },
    );
    setBusy(false);
    if (!r.ok) return setError(errorMessage(r));
    router.push(`/account/announcements?saved=${r.data?.status ?? ''}`);
  }

  if (state === 'loading') return <Skeleton height="20rem" />;
  if (state === 'anonymous')
    return (
      <Alert tone="info" title="Нужно войти">
        Объявления размещают зарегистрированные жители. <Link href="/login">Войти</Link> или{' '}
        <Link href="/register">зарегистрироваться</Link>.
      </Alert>
    );
  if (state === 'error')
    return <Alert tone="error" title="Не удалось загрузить форму. Обновите страницу." />;

  return (
    <form className={styles.form} onSubmit={submit} noValidate={false}>
      {error && <Alert tone="error" title={error} />}
      <TextField
        label="Заголовок"
        required
        minLength={5}
        maxLength={120}
        value={draft.title}
        onChange={(e) => set('title', e.target.value)}
      />
      <Select
        label="Категория"
        required
        value={draft.categoryId}
        onChange={(e) => set('categoryId', e.target.value)}
      >
        <option value="" disabled>
          Выберите категорию
        </option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <TextArea
        label="Описание"
        required
        minLength={10}
        maxLength={5000}
        rows={6}
        value={draft.description}
        onChange={(e) => set('description', e.target.value)}
      />
      <div className={styles.row}>
        <TextField
          label="Цена, ₽"
          hint="Пусто — договорная"
          type="number"
          min={0}
          inputMode="numeric"
          value={draft.price}
          onChange={(e) => set('price', e.target.value)}
        />
        <Select
          label="Состояние"
          value={draft.condition}
          onChange={(e) => set('condition', e.target.value as AnnouncementDraft['condition'])}
        >
          <option value="">Не важно</option>
          <option value="new">Новое</option>
          <option value="used">Б/у</option>
        </Select>
      </div>
      <div className={styles.row}>
        <TextField
          label="Район или улица"
          maxLength={120}
          value={draft.area}
          onChange={(e) => set('area', e.target.value)}
        />
        <TextField
          label="Телефон"
          hint="Виден только на странице объявления"
          type="tel"
          autoComplete="tel"
          value={draft.contactPhone}
          onChange={(e) => set('contactPhone', e.target.value)}
        />
      </div>
      <div>
        <TextField
          label={`Фото (${draft.imageIds.length} из ${MAX_IMAGES})`}
          hint="JPEG, PNG или WebP до 5 МБ"
          type="file"
          accept={TYPES.join(',')}
          multiple
          disabled={uploading || draft.imageIds.length >= MAX_IMAGES}
          onChange={(e) => {
            void upload(e.target.files);
            e.target.value = '';
          }}
        />
        {uploading && <p aria-live="polite">Загружаем…</p>}
        {draft.imageIds.length > 0 && (
          <ul className={styles.thumbs}>
            {draft.imageIds.map((imageId, i) => (
              <li key={imageId}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/media/${imageId}`} alt={`Фото ${i + 1}`} />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    set(
                      'imageIds',
                      draft.imageIds.filter((x) => x !== imageId),
                    )
                  }
                >
                  Убрать
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={styles.actions}>
        <Button type="submit" disabled={busy || uploading}>
          {id ? 'Сохранить' : 'Отправить на публикацию'}
        </Button>
        <Link href="/account/announcements" className={buttonClass({ variant: 'secondary' })}>
          Отмена
        </Link>
      </div>
    </form>
  );
}
