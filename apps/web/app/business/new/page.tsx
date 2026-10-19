'use client';

import { PageHead, styles } from '../../../components/content/Blocks';
import { CommunityForm } from '../../../components/community/CommunityForm';
import { Alert } from '../../../components/ui/Feedback';
import { BUSINESS_FIELDS } from '../../../lib/community-forms';

export default function NewBusinessPage() {
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Заявка на размещение"
        crumbs={[{ label: 'Кабинет бизнеса', href: '/business' }, { label: 'Новая заявка' }]}
      />
      <CommunityForm
        fields={BUSINESS_FIELDS}
        endpoint="/api/business/organizations"
        redirectTo={() => '/business?saved=1'}
        submitLabel="Отправить на проверку"
        loginReason="Заявку подаёт владелец или представитель организации со своим аккаунтом."
        intro={
          <Alert tone="info" title="Как проходит проверка">
            Администратор SVETLY рассматривает заявку: одобряет, отклоняет с объяснением или просит
            уточнить данные. Отметка «Данные проверены» ставится отдельно, после проверки контактов.
          </Alert>
        }
      />
    </main>
  );
}
