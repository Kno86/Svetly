'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Logo } from '../brand/Logo';
import { AccountLink } from './AccountLink';
import { useFeatures, visibleWith } from '../../lib/features';
import { primaryNav } from './navigation';
import styles from './shell.module.css';

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const nav = visibleWith(primaryNav, useFeatures());

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className={styles.header}>
      <div className={`container ${styles.headerInner}`}>
        <Link href="/" className={styles.brand} aria-label="SVETLY — на главную">
          <Logo height={36} title="SVETLY" />
        </Link>
        <nav aria-label="Основные разделы" className={styles.desktopNav}>
          <ul className={styles.navList}>
            {nav.map((item) => (
              <li key={item.href}>
                {item.available ? (
                  <a href={item.href} className={styles.navLink}>
                    {item.label}
                  </a>
                ) : (
                  <span
                    className={styles.navLinkDisabled}
                    aria-disabled="true"
                    title="Раздел в разработке"
                  >
                    {item.label}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.headerActions}>
          <AccountLink />
          <button
            type="button"
            className={styles.menuButton}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            <span className={styles.menuIcon} data-open={open} aria-hidden="true" />
            <span className="visually-hidden">{open ? 'Закрыть меню' : 'Открыть меню'}</span>
          </button>
        </div>
      </div>
      <nav
        id="mobile-nav"
        aria-label="Основные разделы"
        className={styles.mobileNav}
        hidden={!open}
      >
        <ul className="container">
          {nav.map((item) => (
            <li key={item.href}>
              {item.available ? (
                <a href={item.href} className={styles.mobileLink} onClick={() => setOpen(false)}>
                  {item.label}
                </a>
              ) : (
                <span className={styles.mobileLinkDisabled} aria-disabled="true">
                  {item.label}
                  <span className={styles.soon}>скоро</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
