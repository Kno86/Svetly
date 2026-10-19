'use client';

import { PageHead, styles } from '../../../components/content/Blocks';
import { CommunityForm } from '../../../components/community/CommunityForm';
import { Alert } from '../../../components/ui/Feedback';
import { ISSUE_FIELDS } from '../../../lib/community-forms';
import { IssueRouting } from '../IssueTimeline';

export default function NewIssuePage() {
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Сообщить о проблеме"
        description="Опишите проблему территории. Вы получите номер обращения и будете видеть историю статусов в кабинете."
        crumbs={[{ label: 'Обращения', href: '/issues' }, { label: 'Новое обращение' }]}
      />
      <CommunityForm
        fields={ISSUE_FIELDS}
        endpoint="/api/issues"
        redirectTo={(d) => `/account/community?issue=${String(d.number ?? '')}`}
        submitLabel="Отправить обращение"
        loginReason="Обращения принимаются от зарегистрированных жителей, чтобы мы могли сообщить о результате."
        intro={
          <Alert tone="info" title="Что будет после отправки">
            <IssueRouting /> Для экстренных ситуаций звоните 112.
          </Alert>
        }
      />
    </main>
  );
}
