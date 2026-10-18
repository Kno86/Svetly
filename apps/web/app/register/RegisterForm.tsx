'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AuthPanel } from '../../components/auth/AuthPanel';
import styles from '../../components/auth/auth.module.css';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { TextField } from '../../components/ui/Field';
import { apiRequest, errorMessage, MIN_PASSWORD_LENGTH } from '../../lib/auth-client';

export function RegisterForm() {
  const [error, setError] = useState<string>();
  const [mismatch, setMismatch] = useState(false);
  const [sentTo, setSentTo] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password'));
    if (password !== String(form.get('confirm'))) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    setBusy(true);
    setError(undefined);
    const email = String(form.get('email'));
    const result = await apiRequest('/api/auth/sign-up/email', {
      body: {
        name: String(form.get('name')).trim(),
        email,
        password,
        callbackURL: '/verify-email',
      },
    });
    setBusy(false);
    if (result.ok) setSentTo(email);
    else setError(errorMessage(result));
  }

  if (sentTo) {
    return (
      <AuthPanel title="Проверьте почту">
        <Alert tone="success" title="Почти готово">
          Мы отправили письмо со ссылкой для подтверждения на {sentTo}. Ссылка действует 24 часа.
        </Alert>
        <div className={styles.links}>
          <Link href="/login">Перейти ко входу</Link>
        </div>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel
      title="Регистрация"
      lead="Аккаунт жителя SVETLY. После регистрации подтвердите email."
    >
      <form className={styles.form} onSubmit={onSubmit}>
        {error && (
          <Alert tone="error" title="Не удалось зарегистрироваться">
            {error}
          </Alert>
        )}
        <TextField label="Имя" name="name" autoComplete="name" maxLength={100} required />
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
        <TextField
          label="Пароль"
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
          Зарегистрироваться
        </Button>
      </form>
      <div className={styles.links}>
        <span>Уже есть аккаунт?</span>
        <Link href="/login">Войти</Link>
      </div>
    </AuthPanel>
  );
}
