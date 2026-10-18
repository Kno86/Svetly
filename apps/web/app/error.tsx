'use client';

import { Button, ButtonLink } from '../components/ui/Button';
import { Alert } from '../components/ui/Feedback';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      id="main"
      className="container"
      style={{ paddingBlock: 'var(--space-16)', maxWidth: '40rem' }}
    >
      <div className="stack">
        <h1 style={{ fontSize: 'var(--font-size-3xl)' }}>Что-то пошло не так</h1>
        <Alert tone="error" title="Не удалось загрузить страницу">
          Попробуйте ещё раз. Если ошибка повторяется, зайдите позже.
        </Alert>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Button onClick={reset}>Повторить</Button>
          <ButtonLink href="/" variant="secondary">
            На главную
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
