'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AuthPanel } from '../../components/auth/AuthPanel';
import styles from '../../components/auth/auth.module.css';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { TextField } from '../../components/ui/Field';
import { apiRequest, errorMessage, MIN_PASSWORD_LENGTH } from '../../lib/auth-client';

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get('token');
  const [error, setError] = useState<string | undefined>(
    params.get('error') || !token
      ? errorMessage({ ok: false, status: 400, code: 'INVALID_TOKEN' })
      : undefined,
  );
  const [mismatch, setMismatch] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get('password'));
    if (newPassword !== String(form.get('confirm'))) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    setBusy(true);
    setError(undefined);
    const result = await apiRequest('/api/auth/reset-password', { body: { token, newPassword } });
    setBusy(false);
    if (result.ok) setDone(true);
    else setError(errorMessage(result));
  }

  if (done) {
    return (
      <AuthPanel title="Пароль изменён">
        <Alert tone="success" title="Готово">
          Новый пароль сохранён. Все прежние сессии завершены — войдите заново.
        </Alert>
        <div className={styles.links}>
          <Link href="/login">Войти</Link>
        </div>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel title="Новый пароль">
      {error && (
        <Alert tone="error" title="Не удалось сменить пароль">
          {error}
        </Alert>
      )}
      {token && !params.get('error') ? (
        <form className={styles.form} onSubmit={onSubmit}>
          <TextField
            label="Новый пароль"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={128}
            hint={`Не меньше ${MIN_PASSWORD_LENGTH} символов.`}
            required
          />
          <TextField
            label="Повторите пароль"
            name="confirm"
            type="password"
            autoComplete="new-password"
            error={mismatch ? 'Пароли не совпадают.' : undefined}
            required
          />
          <Button type="submit" loading={busy} fullWidth>
            Сохранить пароль
          </Button>
        </form>
      ) : (
        <div className={styles.links}>
          <Link href="/forgot-password">Запросить новую ссылку</Link>
        </div>
      )}
    </AuthPanel>
  );
}
