'use client';

import { useState } from 'react';
import { styles } from '../../../../components/content/Blocks';
import { useApi } from '../../../../components/admin/useApi';
import { Button } from '../../../../components/ui/Button';
import { Alert, Badge, Card, Skeleton } from '../../../../components/ui/Feedback';
import { TextArea } from '../../../../components/ui/Field';
import { apiRequest, errorMessage } from '../../../../lib/auth-client';
import { formatDate } from '../../../../lib/content';

interface Inquiry {
  id: string;
  message: string;
  contact: string | null;
  status: string;
  reply: string | null;
  createdAt: string;
}

export function Inquiries({ id }: { id: string }) {
  const { data, error, reload } = useApi<Inquiry[]>(`/api/business/organizations/${id}/inquiries`);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();

  async function reply(q: Inquiry) {
    const r = await apiRequest(`/api/business/inquiries/${q.id}/reply`, {
      body: { reply: drafts[q.id] ?? '' },
    });
    setMessage(r.ok ? undefined : errorMessage(r));
    reload();
  }

  return (
    <section id="inquiries">
      <h2>Заявки жителей</h2>
      <p className={styles.excerpt}>
        Жители отправляют заявки со страницы опубликованной карточки. Заявки видите только вы.
      </p>
      {message && <Alert tone="error" title={message} />}
      {error && <Alert tone="error" title={error} />}
      {!data && !error && <Skeleton height="6rem" />}
      {data?.length === 0 && <p className={styles.excerpt}>Заявок пока нет.</p>}
      {data?.map((q) => (
        <Card key={q.id}>
          <div className={styles.meta}>
            <Badge tone={q.reply ? 'success' : 'warning'}>{q.reply ? 'Отвечено' : 'Новая'}</Badge>
            <span>{formatDate(q.createdAt, true)}</span>
            {q.contact && <span>Контакт: {q.contact}</span>}
          </div>
          <p>{q.message}</p>
          {q.reply ? (
            <p className={styles.excerpt}>Ваш ответ: {q.reply}</p>
          ) : (
            <>
              <TextArea
                label="Ответ"
                rows={3}
                maxLength={2000}
                value={drafts[q.id] ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
              />
              <Button
                size="sm"
                disabled={(drafts[q.id] ?? '').trim().length < 2}
                onClick={() => void reply(q)}
              >
                Ответить
              </Button>
            </>
          )}
        </Card>
      ))}
    </section>
  );
}
