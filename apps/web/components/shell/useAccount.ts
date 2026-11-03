'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/auth-client';

export interface AccountState {
  /** `undefined` while the session is loading. */
  signedIn?: boolean;
  messages: number;
  notifications: number;
  /** Has any staff permission; the admin pages still check access on the server. */
  staff: boolean;
}

/** Session summary for the shell. Display only: every action is authorised by the API. */
export function useAccount(): AccountState {
  const pathname = usePathname();
  const [state, setState] = useState<AccountState>({ messages: 0, notifications: 0, staff: false });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const s = await apiRequest<{ session: unknown } | null>('/api/auth/get-session');
      const signedIn = Boolean(s.ok && s.data?.session);
      if (!signedIn) {
        if (!cancelled) setState({ signedIn, messages: 0, notifications: 0, staff: false });
        return;
      }
      const [u, me] = await Promise.all([
        apiRequest<{ messages: number; notifications: number }>('/api/me/unread'),
        apiRequest<{ permissions: string[] }>('/api/me'),
      ]);
      if (cancelled) return;
      setState({
        signedIn,
        messages: u.ok && u.data ? u.data.messages : 0,
        notifications: u.ok && u.data ? u.data.notifications : 0,
        staff: Boolean(me.ok && me.data && me.data.permissions.length > 0),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return state;
}
