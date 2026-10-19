'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Alert, Badge, Card, Skeleton } from '../../../components/ui/Feedback';
import { Select, TextField } from '../../../components/ui/Field';
import { useApi } from '../../../components/admin/useApi';
import { apiRequest, errorMessage } from '../../../lib/auth-client';
import styles from '../../../components/admin/admin.module.css';

interface AdminCategory {
  id: string;
  module: string;
  slug: string;
  name: string;
  position: number;
  active: boolean;
}

const MODULES: Record<string, string> = {
  news: 'Новости',
  announcements: 'Объявления',
  services: 'Услуги',
  organizations: 'Организации',
  events: 'События',
  directory: 'Справочник',
};

export default function CategoriesPage() {
  const { data, error, reload } = useApi<AdminCategory[]>('/api/admin/categories');
  const [draft, setDraft] = useState({ module: 'news', slug: '', name: '', position: '0' });
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string }>();

  async function save(path: string, body: unknown, method: 'POST' | 'PATCH', ok: string) {
    const r = await apiRequest(path, { method, body });
    setMessage(r.ok ? { tone: 'success', text: ok } : { tone: 'error', text: errorMessage(r) });
    if (r.ok) reload();
    return r.ok;
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    const ok = await save(
      '/api/admin/categories',
      { ...draft, position: Number(draft.position) || 0 },
      'POST',
      'Категория создана.',
    );
    if (ok) setDraft((d) => ({ ...d, slug: '', name: '' }));
  }

  async function rename(c: AdminCategory) {
    const name = window.prompt('Новое название', c.name)?.trim();
    if (name && name !== c.name)
      await save(`/api/admin/categories/${c.id}`, { name }, 'PATCH', 'Название изменено.');
  }

  return (
    <>
      <div className={styles.head}>
        <h1>Категории</h1>
      </div>
      {message && <Alert tone={message.tone} title={message.text} />}
      <Card>
        <form className={styles.form} onSubmit={create}>
          <h2>Новая категория</h2>
          <div className={styles.toolbar}>
            <Select
              label="Раздел"
              value={draft.module}
              onChange={(e) => setDraft({ ...draft, module: e.target.value })}
            >
              {Object.entries(MODULES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
            <TextField
              label="Название"
              required
              minLength={2}
              maxLength={80}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <TextField
              label="Адрес (slug)"
              hint="латиница, цифры и дефис"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={draft.slug}
              onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
            />
            <TextField
              label="Порядок"
              type="number"
              min={0}
              value={draft.position}
              onChange={(e) => setDraft({ ...draft, position: e.target.value })}
            />
          </div>
          <div>
            <Button type="submit">Добавить</Button>
          </div>
        </form>
      </Card>
      {error && <Alert tone="error" title={error} />}
      {!data && !error && <Skeleton height="10rem" />}
      {data &&
        Object.entries(MODULES).map(([module, label]) => {
          const items = data.filter((c) => c.module === module);
          return (
            <Card key={module} className={styles.item}>
              <h2>{label}</h2>
              {items.length === 0 && <p className={styles.muted}>Категорий нет.</p>}
              {items.map((c) => (
                <div key={c.id} className={styles.actions}>
                  <span>{c.name}</span>
                  <span className={`${styles.muted} ${styles.code}`}>{c.slug}</span>
                  {!c.active && <Badge>скрыта</Badge>}
                  <Button size="sm" variant="ghost" onClick={() => void rename(c)}>
                    Переименовать
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void save(
                        `/api/admin/categories/${c.id}`,
                        { active: !c.active },
                        'PATCH',
                        c.active ? 'Категория скрыта.' : 'Категория показана.',
                      )
                    }
                  >
                    {c.active ? 'Скрыть' : 'Показать'}
                  </Button>
                </div>
              ))}
            </Card>
          );
        })}
    </>
  );
}
