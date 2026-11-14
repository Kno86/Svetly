'use client';

import { useState } from 'react';
import { Button } from '../ui/Button';
import styles from './content.module.css';

/** Native share sheet on phones; copies the link elsewhere or when sharing fails. */
export function ShareButton({ title }: { title: string }) {
  const [result, setResult] = useState<{ ok: boolean; url: string }>();

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setResult({ ok: true, url });
    } catch {
      setResult({ ok: false, url });
    }
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => void share()}>
        Поделиться
      </Button>
      <span role="status" className={styles.meta}>
        {result?.ok && 'Ссылка скопирована'}
        {result && !result.ok && <span>Скопируйте ссылку: {result.url}</span>}
      </span>
    </>
  );
}
