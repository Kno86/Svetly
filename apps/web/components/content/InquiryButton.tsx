'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Feedback';
import { TextArea, TextField } from '../ui/Field';
import { apiRequest, errorMessage } from '../../lib/auth-client';
import styles from './content.module.css';

/** Request to a business with an owner account. Visible only to the sender and the owner. */
export function InquiryButton({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [state, setState] = useState<{
    tone: 'success' | 'error';
    text: string;
    login?: boolean;
  }>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await apiRequest(`/api/organizations/${organizationId}/inquiries`, {
      body: { message: message.trim(), contact: contact.trim() || null },
    });
    setBusy(false);
    if (r.ok) {
      setState({
        tone: 'success',
        text: 'Заявка отправлена владельцу. Ответ появится в вашем кабинете.',
      });
      setOpen(false);
      setMessage('');
    } else
      setState({
        tone: 'error',
        text: r.status === 401 ? 'Чтобы отправить заявку, войдите.' : errorMessage(r),
        login: r.status === 401,
      });
  }

  return (
    <section style={{ marginTop: 'var(--space-6)' }}>
      {state && (
        <Alert tone={state.tone} title={state.text}>
          {state.login && <Link href="/login">Войти</Link>}
          {state.tone === 'success' && <Link href="/account/community">Мои заявки</Link>}
        </Alert>
      )}
      {open ? (
        <form className={styles.form} onSubmit={submit}>
          <TextArea
            label="Сообщение владельцу"
            required
            minLength={10}
            maxLength={2000}
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <TextField
            label="Как с вами связаться (необязательно)"
            hint="Увидит только владелец"
            maxLength={200}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
          <div className={styles.meta}>
            <Button type="submit" disabled={busy}>
              Отправить
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Отмена
            </Button>
          </div>
        </form>
      ) : (
        <Button onClick={() => setOpen(true)}>Оставить заявку</Button>
      )}
    </section>
  );
}
