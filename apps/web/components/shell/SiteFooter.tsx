import Link from 'next/link';
import { Logo } from '../brand/Logo';
import { primaryNav } from './navigation';
import styles from './shell.module.css';

export function SiteFooter({ status }: { status?: string }) {
  const year = new Date().getFullYear();
  return (
    <footer className={`${styles.footer} inverse`}>
      <div className={`container ${styles.footerGrid}`}>
        <div className={styles.footerBrand}>
          <Logo variant="on-dark" height={36} />
          <p>Цифровая платформа жителей посёлка Октябрьский и жилого района Светлый.</p>
        </div>
        <div>
          <h2 className={styles.footerHeading}>Разделы</h2>
          <ul className={styles.footerList}>
            {primaryNav.map((item) => (
              <li key={item.href}>
                {item.available ? (
                  <Link href={item.href}>{item.label}</Link>
                ) : (
                  <>
                    {item.label} <span className={styles.soonDark}>скоро</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className={styles.footerHeading}>Платформа</h2>
          <ul className={styles.footerList}>
            <li>
              <Link href="/search">Поиск</Link>
            </li>
            <li>
              <Link href="/submit">Разместить</Link>
            </li>
            <li>
              <Link href="/design-system">Дизайн-система</Link>
            </li>
            {status && <li data-testid="platform-status">{status}</li>}
          </ul>
        </div>
      </div>
      <div className={`container ${styles.footerBottom}`}>
        <p>© {year} SVETLY. Платформа в разработке.</p>
      </div>
    </footer>
  );
}
