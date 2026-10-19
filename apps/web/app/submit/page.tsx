import type { Metadata } from 'next';
import { Card } from '../../components/ui/Feedback';
import { ButtonLink, PageHead, styles } from '../../components/content/Blocks';

export const metadata: Metadata = {
  title: 'Разместить',
  description: 'Что и как можно опубликовать на SVETLY.',
};

export default function SubmitPage() {
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Разместить на SVETLY"
        description="Публикации новых авторов проходят проверку модератором. После трёх одобренных публикаций без нарушений — быстрее."
        crumbs={[{ label: 'Разместить' }]}
      />
      <div className={styles.list}>
        <Card>
          <h2 className={styles.cardTitle}>Частное объявление</h2>
          <p className={styles.excerpt}>
            Продать, купить, отдать даром, найти потерянное, предложить услугу. Бесплатно, до 6
            фото.
          </p>
          <ButtonLink href="/announcements/new">Подать объявление</ButtonLink>
        </Card>
        <Card>
          <h2 className={styles.cardTitle}>Мои объявления</h2>
          <p className={styles.excerpt}>Статус проверки, редактирование и снятие с публикации.</p>
          <ButtonLink href="/account/announcements" variant="secondary">
            Открыть
          </ButtonLink>
        </Card>
        <Card>
          <h2 className={styles.cardTitle}>Организация или услуга</h2>
          <p className={styles.excerpt}>
            Подайте заявку в кабинете бизнеса. Карточка появится в каталоге после проверки
            администратором.
          </p>
          <ButtonLink href="/business" variant="secondary">
            Кабинет бизнеса
          </ButtonLink>
        </Card>
        <Card>
          <h2 className={styles.cardTitle}>Вакансия, потеря или находка</h2>
          <p className={styles.excerpt}>Публикуются после проверки модератором.</p>
          <ButtonLink href="/jobs/new" variant="secondary">
            Вакансия
          </ButtonLink>{' '}
          <ButtonLink href="/lost-found/new" variant="secondary">
            Потеряно и найдено
          </ButtonLink>
        </Card>
        <Card>
          <h2 className={styles.cardTitle}>Проблема в посёлке</h2>
          <p className={styles.excerpt}>
            Обращение получают сотрудники платформы. Вы видите его номер и историю статусов.
          </p>
          <ButtonLink href="/issues/new" variant="secondary">
            Сообщить о проблеме
          </ButtonLink>
        </Card>
        <Card>
          <h2 className={styles.cardTitle}>Событие или новость</h2>
          <p className={styles.excerpt}>
            Пока их публикует редакция по проверенным данным. Предложить новость можно будет в
            следующих фазах.
          </p>
        </Card>
      </div>
    </main>
  );
}
