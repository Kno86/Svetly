'use client';

import { useParams } from 'next/navigation';
import { PageHead, styles } from '../../../../components/content/Blocks';
import { CabinetSwitch } from '../../../../components/shell/CabinetSwitch';
import { CommunityForm } from '../../../../components/community/CommunityForm';
import { Alert } from '../../../../components/ui/Feedback';
import { BUSINESS_FIELDS } from '../../../../lib/community-forms';
import { Inquiries } from './Inquiries';

export default function BusinessCardPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <main id="main" className={`container ${styles.page}`}>
      <CabinetSwitch current="business" />
      <PageHead
        title="Карточка"
        crumbs={[{ label: 'Кабинет бизнеса', href: '/business' }, { label: 'Карточка' }]}
        action={<a href="#inquiries">Заявки жителей</a>}
      />
      <div className={styles.cabinetSplit}>
        <section>
          <h2>Данные карточки</h2>
          <CommunityForm
            fields={BUSINESS_FIELDS}
            endpoint={`/api/business/organizations/${id}`}
            method="PATCH"
            loadFrom={`/api/business/organizations/${id}`}
            redirectTo={() => '/business?saved=1'}
            submitLabel="Отправить изменения на проверку"
            loginReason="Войдите в аккаунт владельца."
            intro={
              <Alert tone="info" title="Изменения публикуются после проверки">
                Пока администратор не одобрит изменения, в каталоге остаётся текущая версия.
                Изменение названия, телефона, сайта или адреса снимает отметку «Данные проверены» до
                повторной проверки.
              </Alert>
            }
          />
        </section>
        <Inquiries id={id} />
      </div>
    </main>
  );
}
