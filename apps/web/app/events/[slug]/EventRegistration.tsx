'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, buttonClass } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Feedback';
import { apiRequest, errorMessage } from '../../../lib/auth-client';

export function EventRegistration({ eventId, full }: { eventId: string; full: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'anonymous' | 'registered' | 'open'>('loading');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiRequest<{ registered: boolean }>(`/api/events/${eventId}/registration`).then((r) => {
      if (cancelled) return;
      setState(r.ok ? (r.data?.registered ? 'registered' : 'open') : 'anonymous');
    });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  async function toggle(method: 'POST' | 'DELETE') {
    setBusy(true);
    setError(undefined);
    const r = await apiRequest(`/api/events/${eventId}/registration`, { method });
    setBusy(false);
    if (!r.ok) return setError(errorMessage(r));
    setState(method === 'POST' ? 'registered' : 'open');
    router.refresh();
  }

  if (state === 'loading') return null;
  if (state === 'anonymous')
    return (
      <Link href="/login" className={buttonClass({ variant: 'primary' })}>
        Войдите, чтобы записаться
      </Link>
    );
  return (
    <div className="stack">
      {error && <Alert tone="error" title={error} />}
      {state === 'registered' ? (
        <>
          <Alert tone="success" title="Вы записаны на событие" />
          <Button variant="secondary" onClick={() => toggle('DELETE')} disabled={busy}>
            Отменить запись
          </Button>
        </>
      ) : full ? (
        <Alert tone="warning" title="Свободных мест нет" />
      ) : (
        <Button onClick={() => toggle('POST')} disabled={busy}>
          Записаться
        </Button>
      )}
    </div>
  );
}
