'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { contactKind, send, trackingAllowed, utmFrom } from '../../lib/analytics';

/** Page views and contact-link clicks; no cookies, no identifiers, nothing when DNT/GPC is set. */
export function Analytics() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (!trackingAllowed(navigator as Navigator & { globalPrivacyControl?: boolean })) return;
    const initial = first.current;
    first.current = false;
    send({
      name: 'page_view',
      path: pathname,
      ...(initial && document.referrer ? { referrer: document.referrer } : {}),
      ...(initial ? { utm: utmFrom(window.location.search) } : {}),
    });
  }, [pathname]);

  useEffect(() => {
    if (!trackingAllowed(navigator as Navigator & { globalPrivacyControl?: boolean })) return;
    function onClick(e: MouseEvent) {
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (!a) return;
      const kind = contactKind(a.getAttribute('href') ?? '', window.location.hostname);
      if (kind) send({ name: 'contact_click', path: window.location.pathname, kind });
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return null;
}
