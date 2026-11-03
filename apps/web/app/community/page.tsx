import type { Metadata } from 'next';
import { PageHead } from '../../components/content/Blocks';
import styles from '../../components/content/content.module.css';
import { SectionHub, type HubItem } from '../../components/shell/SectionHub';

export const metadata: Metadata = {
  title: 'Сообщество',
  description: 'Лента, группы, события, опросы и обращения жителей.',
};

const items: HubItem[] = [
  { label: 'Лента', href: '/feed', text: 'Посты жителей и групп.', feature: 'groups' },
  { label: 'Группы', href: '/groups', text: 'Сообщества по интересам и домам.', feature: 'groups' },
  { label: 'События', href: '/events', text: 'Праздники, встречи, секции и мероприятия.' },
  { label: 'Опросы', href: '/polls', text: 'Мнение жителей по вопросам посёлка.' },
  {
    label: 'Обращения жителей',
    href: '/issues',
    text: 'Сообщите о проблеме и следите за статусом.',
  },
];

export default function CommunityPage() {
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Сообщество"
        description="Всё, что жители делают вместе: обсуждают, собираются, решают проблемы."
        crumbs={[{ label: 'Сообщество' }]}
      />
      <SectionHub items={items} />
    </main>
  );
}
