import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthPanel } from '../../components/auth/AuthPanel';
import styles from '../../components/auth/auth.module.css';
import { Alert } from '../../components/ui/Feedback';

export const metadata: Metadata = { title: 'Подтверждение email' };

/** Better Auth verifies the token at /api/auth/verify-email and redirects here (with `?error=` on failure). */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthPanel title="Подтверждение email">
      {error ? (
        <Alert tone="error" title="Ссылка недействительна">
          Ссылка устарела или уже использована. Попробуйте войти — мы отправим новое письмо.
        </Alert>
      ) : (
        <Alert tone="success" title="Email подтверждён">
          Спасибо! Теперь можно войти в аккаунт.
        </Alert>
      )}
      <div className={styles.links}>
        <Link href="/login">Войти</Link>
      </div>
    </AuthPanel>
  );
}
