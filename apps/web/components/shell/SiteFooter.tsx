import Link from 'next/link';
import { Logo } from '../brand/Logo';
import { primaryNav } from './navigation';
import styles from './shell.module.css';

const residents = [
  { label: 'Разместить', href: '/submit' },
  { label: 'Обращения жителей', href: '/issues' },
  { label: 'События', href: '/events' },
  { label: 'Справочник', href: '/directory' },
];

export function SiteFooter({ status }: { status?: string }) {
  const year = new Date().getFullYear();
  return (
    <footer className={`${styles.footer} inverse`}>
      <div className={`container ${styles.footerGrid}`}>
        <div className={styles.footerBrand}>
          <Logo variant="on-dark" height={36} />
          <p>
            Цифровая платформа жителей посёлка Октябрьский и жилого района Светлый, Мошковский
            район.
          </p>
        </div>
        <div>
          <h2 className={styles.footerHeading}>Разделы</h2>
          <ul className={styles.footerList}>
            {primaryNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
            <li>
              <Link href="/search">Поиск</Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className={styles.footerHeading}>Жителям</h2>
          <ul className={styles.footerList}>
            {residents.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className={styles.footerHeading}>Платформа</h2>
          <ul className={styles.footerList}>
            <li>
              <Link href="/business">Кабинет бизнеса</Link>
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
