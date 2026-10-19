'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button } from '../../../../components/ui/Button';
import { Alert, Badge, Card, EmptyState, Skeleton } from '../../../../components/ui/Feedback';
import { Checkbox, Select, TextArea, TextField } from '../../../../components/ui/Field';
import { useCan } from '../../../../components/admin/AdminShell';
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

  async function verify(row: Row, verification: 'verified' | 'unverified') {
    const sourceName =
      verification === 'verified'
        ? window.prompt('Как проверены данные (звонок, документ, сайт)?')?.trim()
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
        <div className={styles.item} style={{ overflowX: 'auto' }}>
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
              {list.data.map((row) => {
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
  const set = (name: string, value: string | boolean) =>
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
