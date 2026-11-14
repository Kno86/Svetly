import type { Metadata } from 'next';
import { PageHead } from '../../components/content/Blocks';
import styles from '../../components/content/content.module.css';
import { SectionHub, type HubItem } from '../../components/shell/SectionHub';

export const metadata: Metadata = {
  title: 'Услуги и бизнес',
  description: 'Организации, услуги, справочник и места посёлка Октябрьский и района Светлый.',
};

const items: HubItem[] = [
  {
    label: 'Организации',
    href: '/organizations',
    text: 'Магазины, школы, медицина и сервисы территории.',
    feature: 'organizations',
  },
  {
    label: 'Услуги',
    href: '/services',
    text: 'Местные мастера и услуги — от ремонта до занятий.',
    feature: 'organizations',
  },
  {
    label: 'Справочник',
    href: '/directory',
    text: 'Полезные телефоны, адреса и экстренные службы.',
    feature: 'directory',
  },
  {
    label: 'Места',
    href: '/map',
    text: 'Адреса организаций и мест списком.',
    feature: 'organizations',
  },
];

export default function CatalogPage() {
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Услуги и бизнес"
        description="Карточки добавляют владельцы и редакция после проверки. Мы не заполняем каталог выдуманными данными."
        crumbs={[{ label: 'Услуги и бизнес' }]}
      />
      <SectionHub items={items} />
    </main>
  );
}
