'use client';

import Link from 'next/link';
import { Avatar } from '../ui/Avatar';
import { useState, type FormEvent } from 'react';
import { useApi } from '../admin/useApi';
import { Button } from '../ui/Button';
import { Alert, Badge, EmptyState } from '../ui/Feedback';
import { Select, TextArea } from '../ui/Field';
import { apiRequest, errorMessage } from '../../lib/auth-client';
import { formatDate } from '../../lib/content';
import styles from './content.module.css';

interface Review {
  id: string;
  rating: number;
  body: string;
  publishedAt: string;
  author: { name: string; avatarId: string | null; profileId: string | null };
}
interface ReviewList {
  summary: { count: number; average: number | null };
  items: Review[];
  mine: { rating: number; body: string; status: string; moderationNote: string | null } | null;
  canReview: boolean;
}

const MINE_STATUS: Record<string, { label: string; tone: 'warning' | 'success' | 'error' }> = {
  pending: { label: 'На проверке', tone: 'warning' },
  published: { label: 'Опубликован', tone: 'success' },
  rejected: { label: 'Отклонён', tone: 'error' },
};
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

/** Premoderated reviews. Ratings are shown only from real, approved reviews. */
export function Reviews({ organizationId }: { organizationId: string }) {
  const url = `/api/organizations/${organizationId}/reviews`;
  const { data, error: failed, reload } = useApi<ReviewList>(url);
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState<{ tone: 'success' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const r = await apiRequest(url, {
      body: { rating: Number(form.get('rating')), body: String(form.get('body')).trim() },
    });
    setBusy(false);
    if (r.ok) {
      setState({ tone: 'success', text: 'Отзыв отправлен на проверку модератору.' });
      setEditing(false);
      reload();
    } else setState({ tone: 'error', text: errorMessage(r) });
  }

  async function withdraw() {
    setBusy(true);
    const r = await apiRequest(`${url}/mine`, { method: 'DELETE' });
    setBusy(false);
    if (r.ok) {
      setState({ tone: 'success', text: 'Отзыв удалён.' });
      reload();
    } else setState({ tone: 'error', text: errorMessage(r) });
  }

  const { summary, items, mine, canReview } = data ?? {};
  return (
    <section id="reviews" aria-labelledby="reviews-title" className={styles.reviews}>
      <h2 id="reviews-title">Отзывы</h2>
      {failed && <Alert tone="error" title="Не удалось загрузить отзывы" />}
      {summary && (
        <p className={styles.meta}>
          {summary.average !== null
            ? `Средняя оценка ${summary.average.toLocaleString('ru-RU')} из 5 · отзывов: ${summary.count}`
            : summary.count
              ? `Отзывов: ${summary.count}. Средняя оценка появится от 3 отзывов.`
              : 'Отзывов пока нет.'}{' '}
          Все отзывы проходят проверку модератора.
        </p>
      )}
      {state && <Alert tone={state.tone} title={state.text} />}
      {mine && !editing && (
        <div className={styles.reviewMine}>
          <p>
            Ваш отзыв: <span aria-label={`оценка ${mine.rating} из 5`}>{stars(mine.rating)}</span>{' '}
            <Badge tone={MINE_STATUS[mine.status]?.tone}>{MINE_STATUS[mine.status]?.label}</Badge>
          </p>
          {mine.moderationNote && mine.status === 'rejected' && (
            <p className={styles.meta}>Причина: {mine.moderationNote}</p>
          )}
          <div className={styles.meta}>
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Изменить
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void withdraw()}>
              Удалить
            </Button>
          </div>
        </div>
      )}
      {data && !canReview && !mine && (
        <p className={styles.meta}>
          <span>
            <Link href="/login">Войдите</Link>, чтобы оставить отзыв.
          </span>
        </p>
      )}
      {canReview && (!mine || editing) && (
        <form className={styles.form} onSubmit={submit}>
          <Select label="Оценка" name="rating" defaultValue={String(mine?.rating ?? 5)} required>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} — {stars(n)}
              </option>
            ))}
          </Select>
          <TextArea
            label="Отзыв"
            name="body"
            defaultValue={mine?.body}
            minLength={20}
            maxLength={2000}
            rows={5}
            required
            hint="От 20 до 2000 символов. Пишите о своём опыте и фактах. Не указывайте имена сотрудников, телефоны и адреса — такие отзывы отклоняются."
          />
          <div className={styles.meta}>
            <Button type="submit" loading={busy}>
              {mine ? 'Отправить заново' : 'Отправить на проверку'}
            </Button>
            {editing && (
              <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                Отмена
              </Button>
            )}
          </div>
        </form>
      )}
      {items && items.length === 0 && (
        <EmptyState
          title="Опубликованных отзывов нет"
          description="Здесь появятся отзывы жителей после проверки модератором."
        />
      )}
      {items && items.length > 0 && (
        <ul className={styles.rows} role="list">
          {items.map((r) => (
            <li key={r.id}>
              <p className={styles.meta}>
                <span aria-label={`оценка ${r.rating} из 5`}>{stars(r.rating)}</span> ·{' '}
                <Avatar name={r.author.name} avatarId={r.author.avatarId} />{' '}
                {r.author.profileId ? (
                  <Link href={`/residents/${r.author.profileId}`}>{r.author.name}</Link>
                ) : (
                  r.author.name
                )}{' '}
                · {formatDate(r.publishedAt)}
              </p>
              <p className={styles.reviewBody}>{r.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
