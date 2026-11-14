'use client';

import { useAsk } from '../../../../components/ui/Dialog';
import Link from 'next/link';
import { useMemo, useState, type FormEvent } from 'react';
import { Button } from '../../../../components/ui/Button';
import { Alert, Badge, Card, EmptyState, Skeleton } from '../../../../components/ui/Feedback';
import { Checkbox, Select, TextArea, TextField } from '../../../../components/ui/Field';
import { useCan } from '../../../../components/admin/AdminShell';
import { RichTextEditor } from '../../../../components/ui/RichTextEditor';
import { ImageUploader } from '../../../../components/ui/ImageUploader';
import { useApi } from '../../../../components/admin/useApi';
import { apiRequest, errorMessage } from '../../../../lib/auth-client';
import {
  CONTENT_KINDS,
  toContentPayload,
  toFormValues,
  type ContentKind,
  type FormValues,
} from '../../../../lib/admin';
import { formatDate, type Category } from '../../../../lib/content';
import styles from '../../../../components/admin/admin.module.css';

type Row = Record<string, unknown> & {
  id: string;
  slug: string;
  status: string;
  updatedAt: string;
};

export function ContentManager({ kind: kindKey }: { kind: string }) {
  const kind = CONTENT_KINDS[kindKey]!;
  const list = useApi<Row[]>(`/api/staff/${kind.api}`);
  const canVerify = useCan('organizations.verify');
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string }>();
  const [dialog, ask] = useAsk();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState<'updated' | 'title'>('updated');
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = (list.data ?? []).filter(
      (row) =>
        (!statusFilter || row.status === statusFilter) &&
        (!q ||
          String(row[kind.titleField] ?? '')
            .toLowerCase()
            .includes(q)),
    );
    return sort === 'title'
      ? [...filtered].sort((a, b) =>
          String(a[kind.titleField] ?? '').localeCompare(String(b[kind.titleField] ?? ''), 'ru'),
        )
      : filtered;
  }, [list.data, query, statusFilter, sort, kind.titleField]);

  async function remove(row: Row) {
    const title = String(row[kind.titleField] ?? '');
    const ok = await ask({
      title: `Удалить «${title}»?`,
      description:
        'Запись удалится безвозвратно. Чтобы скрыть её с сайта, лучше перевести в архив.',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (ok === undefined) return;
    const r = await apiRequest(`/api/staff/${kind.api}/${row.id}`, { method: 'DELETE' });
    setMessage(
      r.ok
        ? { tone: 'success', text: 'Запись удалена.' }
        : { tone: 'error', text: errorMessage(r) },
    );
    list.reload();
  }

  async function verify(row: Row, verification: 'verified' | 'unverified') {
    const sourceName =
      verification === 'verified'
        ? (
            await ask({
              title: 'Отметить данные как проверенные?',
              field: 'Как проверены данные (звонок, документ, сайт)',
              confirmLabel: 'Отметить',
            })
          )?.trim()
        : undefined;
    if (verification === 'verified' && !sourceName) return;
    const r = await apiRequest(`/api/admin/organizations/${row.id}/verification`, {
      body: { verification, sourceName },
    });
    setMessage(
      r.ok
        ? { tone: 'success', text: 'Статус проверки обновлён.' }
        : { tone: 'error', text: errorMessage(r) },
    );
    list.reload();
  }

  if (editing)
    return (
      <Editor
        kind={kind}
        record={editing === 'new' ? undefined : editing}
        onDone={(text) => {
          setEditing(null);
          if (text) setMessage({ tone: 'success', text });
          list.reload();
        }}
      />
    );

  return (
    <>
      {dialog}
      <div className={styles.head}>
        <h1>{kind.label}</h1>
        <Button onClick={() => setEditing('new')}>Создать</Button>
      </div>
      {message && <Alert tone={message.tone} title={message.text} />}
      {list.error && <Alert tone="error" title={list.error} />}
      {list.loading && <Skeleton height="10rem" />}
      {list.data?.length === 0 && (
        <EmptyState
          title="Записей пока нет"
          description="Добавляйте только проверенные данные с указанием источника."
        />
      )}
      {list.data && list.data.length > 0 && (
        <div className={styles.toolbar}>
          <TextField
            label="Поиск по названию"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Select
            label="Статус"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Все</option>
            {kind.statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select
            label="Сортировка"
            value={sort}
            onChange={(e) => setSort(e.target.value as 'updated' | 'title')}
          >
            <option value="updated">Сначала изменённые</option>
            <option value="title">По названию</option>
          </Select>
        </div>
      )}
      {list.data && list.data.length > 0 && rows.length === 0 && (
        <EmptyState title="Ничего не найдено" description="Измените поиск или фильтр." />
      )}
      {rows.length > 0 && (
        <div
          className={styles.item}
          style={{ overflowX: 'auto', position: 'relative' }}
          role="region"
          aria-label="Список записей"
          tabIndex={0}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th scope="col" align="left">
                  Название
                </th>
                <th scope="col" align="left">
                  Статус
                </th>
                <th scope="col" align="left">
                  Обновлено
                </th>
                <th scope="col">
                  <span className="visually-hidden">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const title = String(row[kind.titleField] ?? '');
                const status = kind.statuses.find((s) => s.value === row.status);
                return (
                  <tr key={row.id}>
                    <td style={{ padding: 'var(--space-2)' }}>
                      {row.status === 'published' && kind.publicPath !== '/directory' ? (
                        <Link href={`${kind.publicPath}/${row.slug}`}>{title}</Link>
                      ) : (
                        title
                      )}
                      {'verification' in row && (
                        <div>
                          <Badge tone={row.verification === 'verified' ? 'success' : 'neutral'}>
                            {row.verification === 'verified' ? 'Данные проверены' : 'Не проверено'}
                          </Badge>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: 'var(--space-2)' }}>
                      <Badge tone={row.status === 'published' ? 'success' : 'neutral'}>
                        {status?.label ?? row.status}
                      </Badge>
                    </td>
                    <td style={{ padding: 'var(--space-2)' }}>{formatDate(row.updatedAt, true)}</td>
                    <td style={{ padding: 'var(--space-2)' }}>
                      <div className={styles.actions}>
                        <Button size="sm" variant="secondary" onClick={() => setEditing(row)}>
                          Изменить
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void remove(row)}>
                          Удалить
                        </Button>
                        {canVerify && 'verification' in row && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void verify(
                                row,
                                row.verification === 'verified' ? 'unverified' : 'verified',
                              )
                            }
                          >
                            {row.verification === 'verified'
                              ? 'Снять отметку'
                              : 'Отметить проверенной'}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Editor({
  kind,
  record,
  onDone,
}: {
  kind: ContentKind;
  record?: Row;
  onDone: (message?: string) => void;
}) {
  const [values, setValues] = useState<FormValues>(() => toFormValues(kind, record));
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const categories = useApi<Category[]>('/api/categories');
  const options = categories.data?.filter((c) => kind.categoryModules.includes(c.module));
  const set = (name: string, value: string | boolean | string[]) =>
    setValues((v) => ({ ...v, [name]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await apiRequest(`/api/staff/${kind.api}${record ? `/${record.id}` : ''}`, {
      method: record ? 'PATCH' : 'POST',
      body: toContentPayload(kind, values),
    });
    setBusy(false);
    if (r.ok) onDone(record ? 'Изменения сохранены.' : 'Запись создана.');
    else setError(errorMessage(r));
  }

  return (
    <>
      <div className={styles.head}>
        <h1>
          {kind.label}: {record ? 'редактирование' : 'новая запись'}
        </h1>
      </div>
      <Card>
        <form className={styles.form} onSubmit={submit}>
          {error && <Alert tone="error" title={error} />}
          {kind.fields.map((f) => {
            const value = values[f.name];
            const common = { key: f.name, label: f.label, hint: f.hint, required: f.required };
            switch (f.type) {
              case 'images':
              case 'cover':
                return (
                  <ImageUploader
                    key={f.name}
                    label={f.label}
                    hint={f.hint}
                    max={f.type === 'cover' ? 1 : 10}
                    value={Array.isArray(value) ? value : []}
                    onChange={(ids) => set(f.name, ids)}
                  />
                );
              case 'checkbox':
                return (
                  <Checkbox
                    key={f.name}
                    label={f.label}
                    checked={value === true}
                    onChange={(e) => set(f.name, e.target.checked)}
                  />
                );
              case 'textarea':
                return (
                  <TextArea
                    {...common}
                    key={f.name}
                    rows={f.name === 'body' || f.name === 'description' ? 10 : 3}
                    value={String(value)}
                    onChange={(e) => set(f.name, e.target.value)}
                  />
                );
              case 'richtext':
                return (
                  <RichTextEditor
                    {...common}
                    key={f.name}
                    value={String(value)}
                    onChange={(v) => set(f.name, v)}
                  />
                );
              case 'select':
                return (
                  <Select
                    {...common}
                    key={f.name}
                    value={String(value)}
                    onChange={(e) => set(f.name, e.target.value)}
                  >
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                );
              case 'category':
                return (
                  <Select
                    {...common}
                    key={f.name}
                    value={String(value)}
                    onChange={(e) => set(f.name, e.target.value)}
                  >
                    <option value="">Без категории</option>
                    {options?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                );
              default:
                return (
                  <TextField
                    {...common}
                    key={f.name}
                    type={
                      f.type === 'datetime' ? 'datetime-local' : f.type === 'text' ? 'text' : f.type
                    }
                    value={String(value)}
                    onChange={(e) => set(f.name, e.target.value)}
                  />
                );
            }
          })}
          <Select
            label="Статус"
            value={String(values.status)}
            onChange={(e) => set('status', e.target.value)}
          >
            {kind.statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <div className={styles.actions}>
            <Button type="submit" disabled={busy}>
              Сохранить
            </Button>
            <Button type="button" variant="ghost" onClick={() => onDone()}>
              Отмена
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
