import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ButtonLink,
  Empty,
  LoadError,
  PageHead,
  Pager,
  styles,
} from '../../components/content/Blocks';
import { Button } from '../../components/ui/Button';
import { Badge, Card } from '../../components/ui/Feedback';
import { Select, TextField } from '../../components/ui/Field';
import { apiGet, pageParam, param, query, type Paged } from '../../lib/content';
import { excerpt, GROUP_TOPICS } from '../../lib/social';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Группы',
  description: 'Группы жителей по интересам: соседи, родители, спорт, взаимопомощь.',
};

interface GroupItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  topic: string;
  visibility: 'open' | 'closed';
  members: number;
}

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = param(sp, 'q');
  const topic = param(sp, 'topic');
  const page = pageParam(sp);
  const list = await apiGet<Paged<GroupItem>>(`/api/groups${query({ q, topic, page })}`);
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Группы"
        description="Группы создают жители. Новая группа появляется в списке после проверки модератором."
        crumbs={[{ label: 'Группы' }]}
        action={<ButtonLink href="/groups/new">Создать группу</ButtonLink>}
      />
      <form method="get" action="/groups" className={styles.filters} role="search">
        <TextField label="Поиск" name="q" type="search" defaultValue={q} />
        <Select label="Тема" name="topic" defaultValue={topic ?? ''}>
          <option value="">Все темы</option>
          {Object.entries(GROUP_TOPICS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Найти
        </Button>
      </form>
      {!list.ok ? (
        <LoadError />
      ) : list.data.items.length === 0 ? (
        <Empty
          filtered={!!(q || topic)}
          title="Групп пока нет"
          description="Создайте первую группу — она станет видна после проверки модератором."
        />
      ) : (
        <>
          <div className={styles.list}>
            {list.data.items.map((g) => (
              <Card key={g.id} interactive>
                <h2>
                  <Link href={`/groups/${g.slug}`}>{g.name}</Link>
                </h2>
                <p>{excerpt(g.description)}</p>
                <p>
                  <Badge>{GROUP_TOPICS[g.topic] ?? g.topic}</Badge>{' '}
                  <Badge tone={g.visibility === 'open' ? 'success' : 'neutral'}>
                    {g.visibility === 'open' ? 'Открытая' : 'Закрытая'}
                  </Badge>{' '}
                  Участников: {g.members}
                </p>
              </Card>
            ))}
          </div>
          <Pager
            path="/groups"
            page={list.data.page}
            total={list.data.total}
            limit={list.data.limit}
            params={{ q, topic }}
          />
        </>
      )}
    </main>
  );
}
