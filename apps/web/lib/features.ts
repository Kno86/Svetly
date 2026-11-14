'use client';

import { useEffect, useState } from 'react';

/** Feature on/off map from the API. Unknown or not yet loaded flags count as enabled to avoid layout jumps. */
export function useFeatures(): Record<string, boolean> {
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let cancelled = false;
    fetch('/api/features', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : {}))
      .then((f: Record<string, boolean>) => !cancelled && setFeatures(f))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return features;
}

export { visibleWith } from './feature-filter';
