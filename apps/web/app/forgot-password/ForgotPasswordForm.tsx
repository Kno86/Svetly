'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AuthPanel } from '../../components/auth/AuthPanel';
import styles from '../../components/auth/auth.module.css';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { TextField } from '../../components/ui/Field';
import { apiRequest, errorMessage } from '../../lib/auth-client';

export function ForgotPasswordForm() {
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(undefined);
    const result = await apiRequest('/api/auth/request-password-reset', {
      body: { email: String(form.get('email')), redirectTo: '/reset-password' },
    });
    setBusy(false);
    if (result.ok) setDone(true);
    else setError(errorMessage(result));
  }

  return (
    <AuthPanel
      title="Восстановление пароля"
      lead="Укажите email, на который зарегистрирован аккаунт."
    >
      {done ? (
        <Alert tone="success" title="Запрос принят">
          Если аккаунт с этим email существует, мы отправили на него ссылку для сброса пароля.
          Ссылка действует 1 час.
        </Alert>
      ) : (
        <form className={styles.form} onSubmit={onSubmit}>
          {error && (
            <Alert tone="error" title="Не удалось отправить запрос">
              {error}
            </Alert>
          )}
          <TextField label="Email" name="email" type="email" autoComplete="email" required />
          <Button type="submit" loading={busy} fullWidth>
            Отправить ссылку
          </Button>
        </form>
      )}
      <div className={styles.links}>
        <Link href="/login">Вернуться ко входу</Link>
      </div>
    </AuthPanel>
  );
}
