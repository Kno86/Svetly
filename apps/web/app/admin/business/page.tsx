'use client';

import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Alert, Badge, Card, EmptyState, Skeleton } from '../../../components/ui/Feedback';
import { useApi } from '../../../components/admin/useApi';
import { apiRequest, errorMessage } from '../../../lib/auth-client';
import { formatDate } from '../../../lib/content';
import styles from '../../../components/admin/admin.module.css';

const FIELDS: Array<[string, string]> = [
  ['kind', 'Тип'],
  ['name', 'Название'],
  ['description', 'Описание'],
  ['services', 'Услуги и цены'],
  ['phone', 'Телефон'],
  ['website', 'Сайт'],
  ['address', 'Адрес'],
  ['serviceArea', 'География'],
  ['hours', 'График'],
];

interface Application extends Record<string, unknown> {
  id: string;
  name: string;
  type: 'application' | 'changes';
  submittedAt: string | null;
  verification: string;
  pendingChanges: Record<string, unknown> | null;
  owner: { name: string; email: string } | null;
}

const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));

export default function BusinessReviewPage() {
  const { data, error, reload } = useApi<Application[]>('/api/admin/business/applications');
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string }>();

  async function decide(a: Application, decision: 'approve' | 'reject' | 'request_info') {
    let note: string | undefined;
    if (decision !== 'approve') {
      note = window
        .prompt(
          decision === 'reject'
            ? 'Причина отказа (увидит владелец):'
            : 'Что уточнить (увидит владелец):',
        )
        ?.trim();
      if (!note) return;
    }
    const r = await apiRequest(`/api/admin/business/applications/${a.id}/${decision}`, {
      body: note ? { note } : {},
    });
    setMessage(
      r.ok
        ? { tone: 'success', text: `«${a.name}»: решение сохранено.` }
        : { tone: 'error', text: errorMessage(r) },
    );
    reload();
  }

  return (
    <>
      <div className={styles.head}>
        <h1>Заявки бизнеса</h1>
      </div>
      <p className={styles.muted}>
        Одобрение публикует карточку или применяет изменения. Отметку «Данные проверены» ставят
        отдельно в разделе организаций.
      </p>
      {message && <Alert tone={message.tone} title={message.text} />}
      {error && <Alert tone="error" title={error} />}
      {!data && !error && <Skeleton height="10rem" />}
      {data?.length === 0 && (
        <EmptyState title="Заявок нет" description="Новых заявок и изменений от владельцев нет." />
      )}
      {data?.map((a) => (
        <Card key={a.id} className={styles.item}>
          <div className={styles.actions}>
            <Badge tone="warning">
              {a.type === 'application' ? 'Новая карточка' : 'Изменения карточки'}
            </Badge>
            {a.submittedAt && (
              <span className={styles.muted}>{formatDate(a.submittedAt, true)}</span>
            )}
            {a.owner && (
              <span className={styles.muted}>
                Владелец: {a.owner.name} ({a.owner.email})
              </span>
            )}
          </div>
          <h2>{a.name}</h2>
          <dl>
            {FIELDS.map(([key, label]) => {
              const next = a.pendingChanges?.[key];
              const changed = a.pendingChanges && show(next) !== show(a[key]);
              return (
                <div key={key}>
                  <dt className={styles.muted}>{label}</dt>
                  <dd className={styles.pre}>
                    {changed ? (
                      <>
                        <del>{show(a[key])}</del> → <ins>{show(next)}</ins>
                      </>
                    ) : (
                      show(a[key])
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
          <div className={styles.actions}>
            <Button size="sm" onClick={() => void decide(a, 'approve')}>
              Одобрить
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void decide(a, 'request_info')}>
              Запросить уточнение
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void decide(a, 'reject')}>
              Отклонить
            </Button>
          </div>
        </Card>
      ))}
    </>
  );
}
