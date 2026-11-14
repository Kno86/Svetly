'use client';

import { useState } from 'react';
import { checkImage } from '../content/AnnouncementForm';
import { apiRequest, errorMessage } from '../../lib/auth-client';
import { Button } from './Button';
import { TextField } from './Field';
import styles from './ImageUploader.module.css';

const IMAGE_TYPES = 'image/jpeg,image/png,image/webp';

/** Upload, reorder and remove photos; the first photo is the preview shown in lists. */
export function ImageUploader({
  label,
  value,
  onChange,
  max = 10,
  hint,
}: {
  label: string;
  value: string[];
  onChange: (ids: string[]) => void;
  max?: number;
  hint?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();

  async function upload(files: FileList | null) {
    if (!files) return;
    setError(undefined);
    setUploading(true);
    const added: string[] = [];
    for (const file of [...files].slice(0, max - value.length)) {
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
    onChange([...value, ...added].slice(0, max));
  }

  const move = (from: number, to: number) => {
    const next = [...value];
    const [id] = next.splice(from, 1);
    next.splice(to, 0, id!);
    onChange(next);
  };

  return (
    <div className={styles.root}>
      <TextField
        label={max === 1 ? label : `${label} (${value.length} из ${max})`}
        hint={
          hint ??
          (max === 1
            ? 'JPEG, PNG или WebP до 5 МБ'
            : 'Первое фото — превью. JPEG, PNG или WebP до 5 МБ')
        }
        type="file"
        accept={IMAGE_TYPES}
        multiple={max > 1}
        disabled={uploading || value.length >= max}
        onChange={(e) => {
          void upload(e.target.files);
          e.target.value = '';
        }}
      />
      {uploading && <p aria-live="polite">Загружаем…</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {value.length > 0 && (
        <ul className={styles.grid}>
          {value.map((id, i) => (
            <li key={id} className={styles.item}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/media/${id}`} alt={`Фото ${i + 1}`} />
              {i === 0 && max > 1 && <span className={styles.badge}>Превью</span>}
              <div className={styles.actions}>
                {i > 0 && (
                  <Button type="button" size="sm" variant="secondary" onClick={() => move(i, 0)}>
                    Сделать превью
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => onChange(value.filter((x) => x !== id))}
                >
                  Убрать
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
