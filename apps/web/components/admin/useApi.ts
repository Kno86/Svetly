'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest, errorMessage } from '../../lib/auth-client';

interface State<T> {
  data?: T;
  error?: string;
  status?: number;
}

/** GET a staff endpoint; `reload()` refetches after a mutation. `null` path = skip. */
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<State<T>>({});
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    void apiRequest<T>(path).then((r) => {
      if (cancelled) return;
      setState(
        r.ok ? { data: r.data, status: r.status } : { error: errorMessage(r), status: r.status },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [path, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, loading: !state.data && !state.error, reload };
}
