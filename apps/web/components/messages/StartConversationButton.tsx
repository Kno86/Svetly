'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '../ui/Button';
import { apiRequest, errorMessage } from '../../lib/auth-client';

/** Opens (or creates) the direct conversation with the author of a visible post or comment. */
export function StartConversationButton({
  postId,
  commentId,
}: {
  postId?: string;
  commentId?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; login?: boolean }>();

  async function start() {
    setBusy(true);
    const r = await apiRequest<{ id: string }>('/api/conversations', {
      body: postId ? { postId } : { commentId },
    });
    setBusy(false);
    if (r.ok && r.data) return router.push(`/messages/${r.data.id}`);
    setError(
      r.status === 401
        ? { text: 'Войдите, чтобы написать сообщение.', login: true }
        : { text: errorMessage(r) },
    );
  }

  return (
    <>
      <Button size="sm" variant="ghost" loading={busy} onClick={() => void start()}>
        Написать автору
      </Button>
      {error && (
        <span role="alert">
          {error.text} {error.login && <Link href="/login">Войти</Link>}
        </span>
      )}
    </>
  );
}
