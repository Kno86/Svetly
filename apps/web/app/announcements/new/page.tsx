import type { Metadata } from 'next';
import { PageHead, styles } from '../../../components/content/Blocks';
import { AnnouncementForm } from '../../../components/content/AnnouncementForm';

export const metadata: Metadata = { title: 'Подать объявление', robots: { index: false } };

export default function NewAnnouncementPage() {
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Подать объявление"
        description="Первые объявления проверяет модератор, обычно это занимает до суток. Срок размещения — 30 дней."
        crumbs={[{ label: 'Объявления', href: '/announcements' }, { label: 'Новое' }]}
      />
      <AnnouncementForm />
    </main>
  );
}
