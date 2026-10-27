'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { buttonClass } from '../ui/Button';
import { apiRequest } from '../../lib/auth-client';

/** Shows «Войти» or «Кабинет» depending on the session; access control itself is enforced by the API. */
export function AccountLink() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState<boolean>();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    void apiRequest<{ session: unknown } | null>('/api/auth/get-session').then(async (r) => {
      const active = Boolean(r.ok && r.data?.session);
      setSignedIn(active);
      if (!active) return setUnread(0);
      const u = await apiRequest<{ messages: number; notifications: number }>('/api/me/unread');
      setUnread(u.ok && u.data ? u.data.messages + u.data.notifications : 0);
    });
  }, [pathname]);

  return signedIn ? (
    <Link href="/account" className={buttonClass({ variant: 'secondary', size: 'sm' })}>
      Кабинет
      {unread > 0 && <span aria-label={`, непрочитанных: ${unread}`}> · {unread}</span>}
    </Link>
  ) : (
    <Link href="/login" className={buttonClass({ variant: 'primary', size: 'sm' })}>
      Войти
    </Link>
  );
}
