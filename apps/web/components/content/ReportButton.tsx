'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Feedback';
import { Select, TextArea } from '../ui/Field';
import { apiRequest, errorMessage } from '../../lib/auth-client';
import { COMPLAINT_REASONS } from '../../lib/admin';
import styles from './content.module.css';

/** Complaint form for published content; the API requires a signed-in resident. */
export function ReportButton({
  entityType,
  entityId,
}: {
  entityType:
    | 'announcement'
    | 'news'
    | 'event'
    | 'organization'
    | 'job'
    | 'lost_found'
    | 'group'
    | 'post'
    | 'comment'
    | 'message';
  entityId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('wrong_info');
  const [details, setDetails] = useState('');
  const [state, setState] = useState<{
    tone: 'success' | 'error';
    text: string;
    login?: boolean;
  }>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await apiRequest('/api/complaints', {
      body: { entityType, entityId, reason, details },
    });
    setBusy(false);
    if (r.ok) {
      setState({ tone: 'success', text: 'Жалоба отправлена. Модераторы рассмотрят её.' });
      setOpen(false);
    } else if (r.status === 401)
      setState({ tone: 'error', text: 'Чтобы пожаловаться, войдите в аккаунт.', login: true });
    else setState({ tone: 'error', text: errorMessage(r) });
  }

  return (
    <div className={styles.form} style={{ marginTop: 'var(--space-6)' }}>
      {state && (
        <Alert tone={state.tone} title={state.text}>
          {state.login && <Link href="/login">Войти</Link>}
        </Alert>
      )}
      {!open && state?.tone !== 'success' && (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
            Сообщить о проблеме
          </Button>
        </div>
      )}
      {open && (
        <form onSubmit={submit} className={styles.form} aria-label="Жалоба на публикацию">
          <Select label="Причина" value={reason} onChange={(e) => setReason(e.target.value)}>
            {Object.entries(COMPLAINT_REASONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <TextArea
            label="Подробности"
            hint={
              entityType === 'message'
                ? 'Необязательно, до 2000 символов. Модератор увидит текст только этого сообщения, не всю переписку.'
                : 'Необязательно, до 2000 символов'
            }
            maxLength={2000}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
          <div className={styles.row}>
            <Button type="submit" disabled={busy}>
              Отправить жалобу
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Отмена
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
