import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHead, styles } from '../../../../components/content/Blocks';
import { AnnouncementForm } from '../../../../components/content/AnnouncementForm';

export const metadata: Metadata = { title: 'Редактировать объявление', robots: { index: false } };

/** `[slug]` here carries the announcement id: edits are owner-only and resolved through /api/me/announcements/:id. */
export default async function EditAnnouncementPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Редактировать объявление"
        description="После изменения объявление может снова уйти на проверку."
        crumbs={[
          { label: 'Мои объявления', href: '/account/announcements' },
          { label: 'Редактирование' },
        ]}
      />
      <AnnouncementForm id={id} />
    </main>
  );
}
