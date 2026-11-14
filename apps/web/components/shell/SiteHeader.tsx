'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Logo } from '../brand/Logo';
import { ThemeToggle } from './ThemeToggle';
import { buttonClass } from '../ui/Button';
import { cx } from '../ui/cx';
import { Icon } from '../ui/Icon';
import { useFeatures, visibleWith } from '../../lib/features';
import { isActive, loginHref, moreNav, primaryNav, safeNext } from './navigation';
import { useAccount } from './useAccount';
import styles from './shell.module.css';

export const RETURN_KEY = 'svetly:return';

function count(n: number, what: string) {
  return n > 0 ? `${what}, непрочитанных: ${n}` : what;
}

export function SiteHeader() {
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = useState(false);
  const account = useAccount();
  const features = useFeatures();
  const more = visibleWith(moreNav, features);
  const nav = visibleWith(primaryNav, features);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const login = loginHref(pathname);

  useEffect(() => {
    const here = `${window.location.pathname}${window.location.search}`;
    if (safeNext(here)) sessionStorage.setItem(RETURN_KEY, here);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const toggle = toggleRef.current;
    window.addEventListener('keydown', onKey);
    document.documentElement.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = '';
      toggle?.focus();
    };
  }, [open]);

  const unread = account.messages + account.notifications;

  return (
    <>
      <header className={styles.header}>
        <div className={`container ${styles.headerInner}`}>
          <Link href="/" className={styles.brand} aria-label="SVETLY — на главную">
            <Logo height={36} title="SVETLY" />
          </Link>
          <nav aria-label="Основные разделы" className={styles.desktopNav}>
            <ul className={styles.navList}>
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={styles.navLink}
                    aria-current={isActive(item, pathname) ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className={styles.headerActions}>
            <Link
              href="/search"
              className={styles.iconButton}
              aria-label="Поиск"
              aria-current={pathname === '/search' ? 'page' : undefined}
            >
              <Icon name="search" />
            </Link>
            <ThemeToggle />
            {account.signedIn && (
              <>
                <Link
                  href="/messages"
                  className={cx(styles.iconButton, styles.hideMobile)}
                  aria-label={count(account.messages, 'Сообщения')}
                >
                  <Icon name="chat" />
                  {account.messages > 0 && (
                    <span className={styles.counter}>{account.messages}</span>
                  )}
                </Link>
                <Link
                  href="/notifications"
                  className={cx(styles.iconButton, styles.hideMobile)}
                  aria-label={count(account.notifications, 'Уведомления')}
                >
                  <Icon name="bell" />
                  {account.notifications > 0 && (
                    <span className={styles.counter}>{account.notifications}</span>
                  )}
                </Link>
              </>
            )}
            <Link
              href="/submit"
              className={buttonClass({ variant: 'primary', size: 'sm' }, styles.hideMobile)}
            >
              <Icon name="plus" size={18} />
              <span>Разместить</span>
            </Link>
            {account.staff && (
              <Link
                href="/admin"
                className={cx(styles.iconButton, styles.hideTablet)}
                aria-label="Админ-платформа"
                title="Админ-платформа"
              >
                <Icon name="shield" />
              </Link>
            )}
            {account.signedIn === false && (
              <Link
                href={login}
                className={buttonClass({ variant: 'secondary', size: 'sm' }, styles.hideMobile)}
              >
                Войти
              </Link>
            )}
            {account.signedIn && (
              <Link
                href="/account"
                className={buttonClass({ variant: 'secondary', size: 'sm' }, styles.hideMobile)}
              >
                Кабинет
              </Link>
            )}
            <button
              ref={toggleRef}
              type="button"
              className={cx(styles.iconButton, styles.menuButton)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen(true)}
            >
              <Icon name="menu" />
              <span className="visually-hidden">Открыть меню</span>
            </button>
          </div>
        </div>
      </header>

      <div className={styles.overlay} hidden={!open} onClick={() => setOpen(false)} />
      <div
        id="mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Меню"
        className={styles.drawer}
        hidden={!open}
        onClick={(e) => (e.target as HTMLElement).closest('a') && setOpen(false)}
      >
        <div className={styles.drawerHead}>
          <Logo height={32} title="SVETLY" />
          <button
            ref={closeRef}
            type="button"
            className={styles.iconButton}
            onClick={() => setOpen(false)}
          >
            <Icon name="close" />
            <span className="visually-hidden">Закрыть меню</span>
          </button>
        </div>
        <Link href="/submit" className={buttonClass({ variant: 'primary', fullWidth: true })}>
          <Icon name="plus" size={18} />
          <span>Разместить</span>
        </Link>
        <nav aria-label="Разделы">
          <ul className={styles.drawerList}>
            <li>
              <Link
                href="/"
                className={styles.drawerLink}
                aria-current={pathname === '/' ? 'page' : undefined}
              >
                Главная
              </Link>
            </li>
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={styles.drawerLink}
                  aria-current={isActive(item, pathname) ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/search" className={styles.drawerLink}>
                Поиск
              </Link>
            </li>
          </ul>
          <h2 className={styles.drawerHeading}>Ещё</h2>
          <ul className={cx(styles.drawerList, styles.drawerMore)}>
            {more.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={styles.drawerLink}
                  aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <h2 className={styles.drawerHeading}>Аккаунт</h2>
        <ul className={cx(styles.drawerList, styles.drawerMore)}>
          {account.signedIn ? (
            <>
              <li>
                <Link href="/account" className={styles.drawerLink}>
                  Кабинет
                </Link>
              </li>
              <li>
                <Link href="/messages" className={styles.drawerLink}>
                  Сообщения
                  {account.messages > 0 && (
                    <span className={styles.counterInline}>{account.messages}</span>
                  )}
                </Link>
              </li>
              <li>
                <Link href="/notifications" className={styles.drawerLink}>
                  Уведомления
                  {account.notifications > 0 && (
                    <span className={styles.counterInline}>{account.notifications}</span>
                  )}
                </Link>
              </li>
              {account.staff && (
                <li>
                  <Link href="/admin" className={styles.drawerLink}>
                    Админ-платформа
                  </Link>
                </li>
              )}
            </>
          ) : (
            <>
              <li>
                <Link href={login} className={styles.drawerLink}>
                  Войти
                </Link>
              </li>
              <li>
                <Link href="/register" className={styles.drawerLink}>
                  Регистрация
                </Link>
              </li>
            </>
          )}
        </ul>
      </div>

      <nav aria-label="Нижнее меню" className={styles.tabbar}>
        <Link href="/" className={styles.tab} aria-current={pathname === '/' ? 'page' : undefined}>
          <Icon name="home" />
          Главная
        </Link>
        <button
          type="button"
          className={styles.tab}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen(true)}
        >
          <Icon name="grid" />
          Разделы
        </button>
        <Link
          href="/submit"
          className={cx(styles.tab, styles.tabPrimary)}
          aria-current={pathname === '/submit' ? 'page' : undefined}
        >
          <span className={styles.tabFab}>
            <Icon name="plus" />
          </span>
          Разместить
        </Link>
        <Link
          href={account.signedIn ? '/messages' : loginHref('/messages')}
          className={styles.tab}
          aria-current={pathname.startsWith('/messages') ? 'page' : undefined}
          aria-label={count(account.messages, 'Сообщения')}
        >
          <Icon name="chat" />
          Сообщения
          {account.messages > 0 && <span className={styles.counter}>{account.messages}</span>}
        </Link>
        <Link
          href={account.signedIn ? '/account' : login}
          className={styles.tab}
          aria-current={pathname.startsWith('/account') ? 'page' : undefined}
          aria-label={account.signedIn ? count(unread, 'Кабинет') : 'Войти'}
        >
          <Icon name="user" />
          {account.signedIn ? 'Кабинет' : 'Войти'}
        </Link>
      </nav>
    </>
  );
}
