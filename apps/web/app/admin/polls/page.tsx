'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Alert, Badge, Card, EmptyState, Skeleton } from '../../../components/ui/Feedback';
import { Checkbox, Select, TextArea, TextField } from '../../../components/ui/Field';
import { useApi } from '../../../components/admin/useApi';
import { apiRequest, errorMessage } from '../../../lib/auth-client';
import { percent } from '../../../lib/community';
import { formatDate } from '../../../lib/content';
import styles from '../../../components/admin/admin.module.css';

interface Poll {
  id: string;
  slug: string;
  title: string;
  mode: string;
  status: string;
  opensAt: string;
  closesAt: string;
  options: Array<{ id: string; label: string }>;
  _count: { votes: number };
}
interface Results {
  total: number;
  options: Array<{ optionId: string; label: string; votes: number }>;
  voters: Array<{ optionId: string; name: string }> | null;
}

const toIso = (local: string) => (local ? new Date(local).toISOString() : '');

function PollResults({ id }: { id: string }) {
  const { data, error } = useApi<Results>(`/api/staff/polls/${id}/results`);
  if (error) return <Alert tone="error" title={error} />;
  if (!data) return <Skeleton height="4rem" />;
  return (
    <ul>
      {data.options.map((o) => (
        <li key={o.optionId}>
          {o.label}: {o.votes} ({percent(o.votes, data.total)}%)
          {data.voters &&
            ` — ${data.voters
              .filter((v) => v.optionId === o.optionId)
              .map((v) => v.name)
              .join(', ')}`}
        </li>
      ))}
    </ul>
  );
}

export default function AdminPollsPage() {
  const { data, error, reload } = useApi<Poll[]>('/api/staff/polls');
  const [form, setForm] = useState({
    title: '',
    description: '',
    mode: 'anonymous',
    allowRevote: false,
    opensAt: '',
    closesAt: '',
    options: '',
  });
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string }>();
  const [open, setOpen] = useState<string>();

  async function create(e: FormEvent) {
    e.preventDefault();
    const r = await apiRequest('/api/staff/polls', {
      body: {
        ...form,
        opensAt: toIso(form.opensAt),
        closesAt: toIso(form.closesAt),
        status: 'draft',
        options: form.options
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      },
    });
    setMessage(
      r.ok
        ? { tone: 'success', text: 'Черновик опроса создан' }
        : { tone: 'error', text: errorMessage(r) },
    );
    if (r.ok) reload();
  }
  async function setStatus(p: Poll, status: string) {
    const r = await apiRequest(`/api/staff/polls/${p.id}`, { method: 'PATCH', body: { status } });
    setMessage(
      r.ok
        ? { tone: 'success', text: 'Статус обновлён' }
        : { tone: 'error', text: errorMessage(r) },
    );
    reload();
  }

  return (
    <>
      <div className={styles.head}>
        <h1>Опросы</h1>
      </div>
      {message && <Alert tone={message.tone} title={message.text} />}
      <Card className={styles.item}>
        <h2>Новый опрос</h2>
        <form className={styles.form} onSubmit={create}>
          <TextField
            label="Вопрос"
            required
            minLength={5}
            maxLength={200}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <TextArea
            label="Пояснение"
            maxLength={3000}
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <TextArea
            label="Варианты ответа"
            hint="Каждый с новой строки, от 2 до 10"
            required
            rows={4}
            value={form.options}
            onChange={(e) => setForm({ ...form, options: e.target.value })}
          />
          <div className={styles.toolbar}>
            <Select
              label="Режим"
              value={form.mode}
              onChange={(e) => setForm({ ...form, mode: e.target.value })}
            >
              <option value="anonymous">Анонимный</option>
              <option value="identified">Именной (организатор видит ответы)</option>
            </Select>
            <TextField
              label="Открыт с"
              type="datetime-local"
              required
              value={form.opensAt}
              onChange={(e) => setForm({ ...form, opensAt: e.target.value })}
            />
            <TextField
              label="Закрыт с"
              type="datetime-local"
              required
              value={form.closesAt}
              onChange={(e) => setForm({ ...form, closesAt: e.target.value })}
            />
          </div>
          <Checkbox
            label="Разрешить изменить ответ до закрытия"
            checked={form.allowRevote}
            onChange={(e) => setForm({ ...form, allowRevote: e.target.checked })}
          />
          <div>
            <Button type="submit">Создать черновик</Button>
          </div>
        </form>
      </Card>
      {error && <Alert tone="error" title={error} />}
      {!data && !error && <Skeleton height="10rem" />}
      {data?.length === 0 && (
        <EmptyState title="Опросов нет" description="Создайте первый опрос выше." />
      )}
      {data?.map((p) => (
        <Card key={p.id} className={styles.item}>
          <div className={styles.actions}>
            <Badge>
              {p.status === 'draft'
                ? 'Черновик'
                : p.status === 'published'
                  ? 'Опубликован'
                  : 'В архиве'}
            </Badge>
            <Badge>{p.mode === 'identified' ? 'Именной' : 'Анонимный'}</Badge>
            <span className={styles.muted}>
              {formatDate(p.opensAt, true)} — {formatDate(p.closesAt, true)} · ответов:{' '}
              {p._count.votes}
            </span>
          </div>
          <h2>
            {p.status === 'published' ? <Link href={`/polls/${p.slug}`}>{p.title}</Link> : p.title}
          </h2>
          <div className={styles.actions}>
            {p.status !== 'published' && (
              <Button size="sm" onClick={() => void setStatus(p, 'published')}>
                Опубликовать
              </Button>
            )}
            {p.status !== 'archived' && (
              <Button size="sm" variant="secondary" onClick={() => void setStatus(p, 'archived')}>
                В архив
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setOpen(open === p.id ? undefined : p.id)}
            >
              Результаты
            </Button>
          </div>
          {open === p.id && <PollResults id={p.id} />}
        </Card>
      ))}
    </>
  );
}
