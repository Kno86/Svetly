'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Feedback';
import { TextArea, TextField } from '../ui/Field';
import { apiRequest, errorMessage } from '../../lib/auth-client';
import { checkImage } from '../content/AnnouncementForm';
import styles from './social.module.css';

const MAX_IMAGES = 6;

/** New post form for the general feed (`groupId` null) or a group. */
export function Composer({ groupId, onPosted }: { groupId?: string; onPosted: () => void }) {
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string }>();

  async function upload(files: FileList | null) {
    for (const file of Array.from(files ?? []).slice(0, MAX_IMAGES - imageIds.length)) {
      const problem = checkImage(file);
      if (problem) return setNotice({ tone: 'error', text: problem });
      const r = await apiRequest<{ id: string }>('/api/media', { file });
      if (!r.ok || !r.data) return setNotice({ tone: 'error', text: errorMessage(r) });
      const id = r.data.id;
      setImageIds((ids) => [...ids, id]);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await apiRequest<{ status: string }>('/api/posts', {
      body: { groupId: groupId ?? null, body, link: link.trim() || null, imageIds },
    });
    setBusy(false);
    if (!r.ok || !r.data) return setNotice({ tone: 'error', text: errorMessage(r) });
    setBody('');
    setLink('');
    setImageIds([]);
    setNotice({
      tone: 'success',
      text:
        r.data.status === 'published'
          ? 'Пост опубликован.'
          : 'Пост отправлен на проверку модератору. Статус виден в разделе «Мои группы и посты».',
    });
    onPosted();
  }

  return (
    <form className={styles.composer} onSubmit={(e) => void submit(e)}>
      <TextArea
        label="Новый пост"
        name="body"
        required
        minLength={2}
        maxLength={5000}
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        hint="Посты новых авторов проверяет модератор перед публикацией."
      />
      <TextField
        label="Ссылка (необязательно)"
        name="link"
        type="url"
        placeholder="https://"
        value={link}
        onChange={(e) => setLink(e.target.value)}
      />
      <label>
        Фото (до {MAX_IMAGES}, JPEG/PNG/WebP){' '}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={imageIds.length >= MAX_IMAGES}
          onChange={(e) => void upload(e.target.files)}
        />
      </label>
      {imageIds.length > 0 && (
        <div className={styles.images}>
          {imageIds.map((id, i) => (
            <img key={id} src={`/api/media/${id}`} alt={`Фото ${i + 1}`} />
          ))}
        </div>
      )}
      {notice && <Alert tone={notice.tone} title={notice.text} />}
      <div>
        <Button type="submit" loading={busy}>
          Опубликовать
        </Button>
      </div>
    </form>
  );
}
