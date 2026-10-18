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

  useEffect(() => {
    void apiRequest<{ session: unknown } | null>('/api/auth/get-session').then((r) =>
      setSignedIn(Boolean(r.ok && r.data?.session)),
    );
  }, [pathname]);

  return signedIn ? (
    <Link href="/account" className={buttonClass({ variant: 'secondary', size: 'sm' })}>
      Кабинет
    </Link>
  ) : (
    <Link href="/login" className={buttonClass({ variant: 'primary', size: 'sm' })}>
      Войти
    </Link>
  );
}
