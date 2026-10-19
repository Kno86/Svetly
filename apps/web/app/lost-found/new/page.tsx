'use client';

import { PageHead, styles } from '../../../components/content/Blocks';
import { CommunityForm } from '../../../components/community/CommunityForm';
import { LOST_FOUND_FIELDS } from '../../../lib/community-forms';

export default function NewLostFoundPage() {
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Потеря или находка"
        description="Объявления новых авторов публикуются после проверки модератором."
        crumbs={[
          { label: 'Потеряно и найдено', href: '/lost-found' },
          { label: 'Новое объявление' },
        ]}
      />
      <CommunityForm
        fields={LOST_FOUND_FIELDS}
        endpoint="/api/lost-found"
        redirectTo={(d) => `/account/community?saved=${String(d.status ?? '')}`}
        submitLabel="Отправить"
        loginReason="Объявления размещают зарегистрированные жители."
      />
    </main>
  );
}
