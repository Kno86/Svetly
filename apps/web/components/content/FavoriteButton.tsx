'use client';

import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { apiRequest } from '../../lib/auth-client';

type FavoriteType =
  'announcement' | 'news' | 'event' | 'organization' | 'job' | 'lost_found' | 'post';

/** Private bookmark toggle; hidden for anonymous visitors. */
export function FavoriteButton({
  entityType,
  entityId,
}: {
  entityType: FavoriteType;
  entityId: string;
}) {
  const [saved, setSaved] = useState<boolean>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiRequest<{ saved: boolean }>(
      `/api/me/favorites/check?entityType=${entityType}&entityId=${entityId}`,
    ).then((r) => {
      if (!cancelled && r.ok && r.data) setSaved(r.data.saved);
    });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  if (saved === undefined) return null;
  async function toggle() {
    setBusy(true);
    const r = saved
      ? await apiRequest(`/api/favorites/${entityType}/${entityId}`, { method: 'DELETE' })
      : await apiRequest('/api/favorites', { body: { entityType, entityId } });
    setBusy(false);
    if (r.ok) setSaved(!saved);
  }
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={busy}
      aria-pressed={saved}
      onClick={() => void toggle()}
    >
      {saved ? 'В избранном' : 'В избранное'}
    </Button>
  );
}
