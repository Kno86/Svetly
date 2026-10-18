'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AuthPanel } from '../../components/auth/AuthPanel';
import styles from '../../components/auth/auth.module.css';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { TextField } from '../../components/ui/Field';
import { apiRequest, errorMessage } from '../../lib/auth-client';

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(undefined);
    const email = String(form.get('email'));
    const result = await apiRequest('/api/auth/sign-in/email', {
      body: { email, password: String(form.get('password')) },
    });
    setBusy(false);
    if (result.ok) {
      router.push('/account');
      router.refresh();
      return;
    }
    if (result.code === 'EMAIL_NOT_VERIFIED') {
      await apiRequest('/api/auth/send-verification-email', {
        body: { email, callbackURL: '/verify-email' },
      });
    }
    setError(errorMessage(result));
  }

  return (
    <AuthPanel title="Вход" lead="Войдите по email и паролю.">
      <form className={styles.form} onSubmit={onSubmit} noValidate={false}>
        {error && (
          <Alert tone="error" title="Не удалось войти">
            {error}
          </Alert>
        )}
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
        <TextField
          label="Пароль"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <Button type="submit" loading={busy} fullWidth>
          Войти
        </Button>
      </form>
      <div className={styles.links}>
        <Link href="/forgot-password">Забыли пароль?</Link>
        <Link href="/register">Регистрация</Link>
      </div>
    </AuthPanel>
  );
}
