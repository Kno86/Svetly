'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Alert, Badge, EmptyState, Skeleton } from '../../../components/ui/Feedback';
import { TextField } from '../../../components/ui/Field';
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

export default function AuditPage() {
  const [filter, setFilter] = useState({ action: '', before: '' });
  const [input, setInput] = useState('');
  const qs = new URLSearchParams({ limit: '50' });
  if (filter.action) qs.set('action', filter.action);
  if (filter.before) qs.set('before', filter.before);
  const { data, error } = useApi<Entry[]>(`/api/admin/audit-log?${qs}`);

  function apply(e: FormEvent) {
    e.preventDefault();
    setFilter({ action: input.trim(), before: '' });
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
          hint="Точное имя, например complaint.resolved"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button type="submit" variant="secondary">
          Показать
        </Button>
      </form>
      {error && <Alert tone="error" title={error} />}
      {!data && !error && <Skeleton height="10rem" />}
      {data?.length === 0 && <EmptyState title="Записей нет" description="Измените фильтр." />}
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
