'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Alert, Skeleton } from '../ui/Feedback';
import { apiRequest, errorMessage } from '../../lib/auth-client';
import { ADMIN_NAV, groupNav, navFor } from '../../lib/admin';
import styles from './admin.module.css';

interface Me {
  user: { id: string; name: string; email: string };
  roles: string[];
  permissions: string[];
}

const StaffContext = createContext<Me | null>(null);

export function useStaff(): Me {
  const me = useContext(StaffContext);
  if (!me) throw new Error('useStaff outside AdminShell');
  return me;
}

export function useCan(permission: string): boolean {
  return useStaff().permissions.includes(permission);
}

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me>();
  const [error, setError] = useState<string>();
  // The mobile menu closes itself on navigation: it is open only for the page it was opened on.
  const [menuFor, setMenuFor] = useState<string>();
  const menuOpen = menuFor === pathname;

  useEffect(() => {
    let cancelled = false;
    void apiRequest<Me>('/api/me').then((r) => {
      if (cancelled) return;
      if (r.status === 401) router.replace('/login');
      else if (!r.ok || !r.data) setError(errorMessage(r));
      else setMe(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error)
    return (
      <main id="main" className={`container ${styles.page}`}>
        <Alert tone="error" title={error} />
      </main>
    );
  if (!me)
    return (
      <main id="main" className={`container ${styles.page}`}>
        <Skeleton height="16rem" />
      </main>
    );
  const nav = navFor(me.permissions);
  if (nav.length === 0)
    return (
      <main id="main" className={`container ${styles.page}`}>
        <Alert tone="warning" title="Нет доступа к админ-платформе">
          Раздел доступен только сотрудникам с назначенной ролью.{' '}
          <Link href="/account">В кабинет</Link>
        </Alert>
      </main>
    );

  return (
    <StaffContext.Provider value={me}>
      <div className={`container ${styles.layout}`}>
        <nav className={styles.side} aria-label="Разделы админ-платформы">
          <p className={styles.sideTitle}>Админ-платформа</p>
          <button
            type="button"
            className={styles.menuToggle}
            aria-expanded={menuOpen}
            aria-controls="admin-nav"
            onClick={() => setMenuFor(menuOpen ? undefined : pathname)}
          >
            {nav.find((i) => isActive(i.href, pathname))?.label ?? 'Разделы'}
            <span aria-hidden="true">{menuOpen ? '▴' : '▾'}</span>
          </button>
          <div id="admin-nav" className={`${styles.sideGroups} ${menuOpen ? styles.open : ''}`}>
            {groupNav(nav).map(({ group, items }) => (
              <div key={group ?? 'top'}>
                {group && <p className={styles.groupTitle}>{group}</p>}
                <ul>
                  {items.map((item) => {
                    const active = isActive(item.href, pathname);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={active ? styles.active : undefined}
                          aria-current={active ? 'page' : undefined}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>
        <main id="main" className={styles.main}>
          {children}
        </main>
      </div>
    </StaffContext.Provider>
  );
}

function matches(href: string, pathname: string): boolean {
  return href === '/admin'
    ? pathname === '/admin'
    : pathname === href || pathname.startsWith(`${href}/`);
}

/** The most specific nav entry wins, so nested sections don't light up their parent. */
function isActive(href: string, pathname: string): boolean {
  return (
    matches(href, pathname) &&
    !ADMIN_NAV.some((i) => i.href.length > href.length && matches(i.href, pathname))
  );
}
