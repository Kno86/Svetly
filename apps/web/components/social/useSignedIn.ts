'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/auth-client';

/** `undefined` while checking, then whether the visitor has a valid session. */
export function useSignedIn(): boolean | undefined {
  const [signedIn, setSignedIn] = useState<boolean>();
  useEffect(() => {
    void apiRequest('/api/me').then((r) => setSignedIn(r.ok));
  }, []);
  return signedIn;
}
