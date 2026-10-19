'use client';

import Link from 'next/link';
import { Alert, Card, Skeleton } from '../../components/ui/Feedback';
import { useApi } from '../../components/admin/useApi';
import { useStaff } from '../../components/admin/AdminShell';
import styles from '../../components/admin/admin.module.css';

const COUNTERS: Array<{ key: string; label: string; href: string }> = [
  { key: 'pendingAnnouncements', label: 'Объявлений на проверке', href: '/admin/moderation' },
  { key: 'openComplaints', label: 'Открытых жалоб', href: '/admin/complaints' },
  { key: 'draftNews', label: 'Черновиков новостей', href: '/admin/content/news' },
  { key: 'upcomingEvents', label: 'Предстоящих событий', href: '/admin/content/events' },
  {
    key: 'unverifiedOrganizations',
    label: 'Непроверенных организаций',
    href: '/admin/content/organizations',
  },
  {
    key: 'staleDirectory',
    label: 'Записей справочника без проверки за 180 дней',
    href: '/admin/content/directory',
  },
  { key: 'users', label: 'Пользователей', href: '/admin/users' },
];

export default function AdminDashboard() {
  const me = useStaff();
  const { data, error } = useApi<{ counters: Record<string, number> }>('/api/admin/dashboard');
  return (
    <>
      <div className={styles.head}>
        <h1>Обзор</h1>
        <p className={styles.muted}>{me.user.email}</p>
      </div>
      {error && <Alert tone="error" title={error} />}
      {!data && !error && <Skeleton height="8rem" />}
      {data && (
        <div className={styles.counters}>
          {COUNTERS.filter((c) => c.key in data.counters).map((c) => (
            <Link key={c.key} href={c.href} className={styles.counter}>
              <Card>
                <span className={styles.counterValue}>{data.counters[c.key]}</span>
                <span className={styles.muted}>{c.label}</span>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <p className={styles.muted}>
        Видны только разделы, доступные вашей роли. Права проверяются сервером при каждом действии;
        все изменения записываются в журнал аудита.
      </p>
    </>
  );
}
