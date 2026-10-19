'use client';

import { PageHead, styles } from '../../../components/content/Blocks';
import { CommunityForm } from '../../../components/community/CommunityForm';
import { JOB_FIELDS } from '../../../lib/community-forms';

export default function NewJobPage() {
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Разместить вакансию"
        description="Бесплатно. Вакансии новых авторов публикуются после проверки модератором."
        crumbs={[{ label: 'Вакансии', href: '/jobs' }, { label: 'Новая вакансия' }]}
      />
      <CommunityForm
        fields={JOB_FIELDS}
        endpoint="/api/jobs"
        redirectTo={(d) => `/account/community?saved=${String(d.status ?? '')}`}
        submitLabel="Отправить"
        loginReason="Вакансии размещают зарегистрированные пользователи."
      />
    </main>
  );
}
