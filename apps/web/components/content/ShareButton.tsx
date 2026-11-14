'use client';

import { useState } from 'react';
import { Button } from '../ui/Button';
import styles from './content.module.css';

/** Native share sheet on phones; copies the link elsewhere. */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // Dismissed share sheet: nothing to report.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => void share()}>
        Поделиться
      </Button>
      <span role="status" className={styles.meta}>
        {copied ? 'Ссылка скопирована' : ''}
      </span>
    </>
  );
}
