'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Alert, Badge, EmptyState, Skeleton } from '../../../components/ui/Feedback';
import { Select, TextField } from '../../../components/ui/Field';
import { useApi } from '../../../components/admin/useApi';
import { formatDate } from '../../../lib/content';
import styles from '../../../components/admin/admin.module.css';

interface Entry {
  id: string;
  occurredAt: string;
  actorId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  outcome: string;
  metadata: Record<string, unknown>;
}

interface Filter {
  q: string;
  outcome: string;
  entityType: string;
  entityId: string;
  actorId: string;
  from: string;
  to: string;
  before?: string;
}

const EMPTY: Filter = {
  q: '',
  outcome: '',
  entityType: '',
  entityId: '',
  actorId: '',
  from: '',
  to: '',
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AuditPage() {
  const [filter, setFilter] = useState<Filter>({ ...EMPTY, before: '' });
  const [input, setInput] = useState<Filter>(EMPTY);
  const qs = new URLSearchParams({ limit: '50' });
  if (filter.q) qs.set('q', filter.q);
  if (filter.outcome) qs.set('outcome', filter.outcome);
  if (filter.entityType) qs.set('entityType', filter.entityType);
  if (filter.entityId) qs.set('entityId', filter.entityId);
  if (UUID.test(filter.actorId)) qs.set('actorId', filter.actorId);
  if (filter.from) qs.set('after', new Date(`${filter.from}T00:00:00`).toISOString());
  const before =
    filter.before ||
    (filter.to
      ? new Date(new Date(`${filter.to}T00:00:00`).getTime() + 86_400_000).toISOString()
      : '');
  if (before) qs.set('before', before);
  const { data, error } = useApi<Entry[]>(`/api/admin/audit-log?${qs}`);
  const set = (key: keyof Filter) => (e: { target: { value: string } }) =>
    setInput({ ...input, [key]: e.target.value });

  function apply(e: FormEvent) {
    e.preventDefault();
    const trimmed = Object.fromEntries(
      Object.entries(input).map(([k, v]) => [k, v.trim()]),
    ) as Filter;
    setFilter({ ...trimmed, before: '' });
  }

  function reset() {
    setInput(EMPTY);
    setFilter({ ...EMPTY, before: '' });
  }

  return (
    <>
      <div className={styles.head}>
        <h1>Журнал аудита</h1>
      </div>
      <p className={styles.muted}>
        Записи только добавляются: изменить или удалить их нельзя даже на уровне базы данных.
      </p>
      <form className={styles.toolbar} onSubmit={apply}>
        <TextField
          label="Действие"
          hint="Часть имени, например moderation или complaint.resolved"
          value={input.q}
          onChange={set('q')}
        />
        <Select label="Результат" value={input.outcome} onChange={set('outcome')}>
          <option value="">Любой</option>
          <option value="success">Успешно</option>
          <option value="denied">Отказано</option>
          <option value="failure">Ошибка</option>
        </Select>
        <TextField
          label="Тип объекта"
          hint="Например user, announcement"
          value={input.entityType}
          onChange={set('entityType')}
        />
        <TextField label="ID объекта" value={input.entityId} onChange={set('entityId')} />
        <TextField
          label="ID сотрудника или жителя"
          value={input.actorId}
          onChange={set('actorId')}
        />
        <TextField label="С даты" type="date" value={input.from} onChange={set('from')} />
        <TextField label="По дату" type="date" value={input.to} onChange={set('to')} />
        <Button type="submit" variant="secondary">
          Показать
        </Button>
        <Button type="button" variant="ghost" onClick={reset}>
          Сбросить
        </Button>
      </form>
      {error && <Alert tone="error" title={error} />}
      {!data && !error && <Skeleton height="10rem" />}
      {data?.length === 0 && <EmptyState title="Записей нет" description="Измените фильтр." />}
      {input.actorId && !UUID.test(input.actorId.trim()) && (
        <Alert
          tone="warning"
          title="ID сотрудника должен быть в формате UUID — фильтр по нему не применён."
        />
      )}
      {data && data.length > 0 && (
        <div
          style={{ overflowX: 'auto', position: 'relative' }}
          role="region"
          aria-label="Записи журнала"
          tabIndex={0}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th scope="col" align="left">
                  Время
                </th>
                <th scope="col" align="left">
                  Действие
                </th>
                <th scope="col" align="left">
                  Кто
                </th>
                <th scope="col" align="left">
                  Объект
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id}>
                  <td style={{ padding: 'var(--space-2)', whiteSpace: 'nowrap' }}>
                    {formatDate(e.occurredAt, true)}
                  </td>
                  <td style={{ padding: 'var(--space-2)' }}>
                    <span className={styles.code}>{e.action}</span>{' '}
                    <Badge tone={e.outcome === 'success' ? 'success' : 'warning'}>
                      {e.outcome}
                    </Badge>
                  </td>
                  <td style={{ padding: 'var(--space-2)' }} className={styles.code}>
                    {e.actorId ?? '—'}
                  </td>
                  <td style={{ padding: 'var(--space-2)' }} className={styles.code}>
                    {e.entityType ? `${e.entityType}:${e.entityId ?? ''}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.length === 50 && (
        <div>
          <Button
            variant="secondary"
            onClick={() => setFilter({ ...filter, before: data[data.length - 1]!.occurredAt })}
          >
            Более ранние записи
          </Button>
        </div>
      )}
    </>
  );
}
