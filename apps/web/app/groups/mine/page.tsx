'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageHead, styles } from '../../../components/content/Blocks';
import { PostCard } from '../../../components/social/PostCard';
import social from '../../../components/social/social.module.css';
import { Badge, Card, EmptyState, Skeleton } from '../../../components/ui/Feedback';
import { apiRequest } from '../../../lib/auth-client';
import { MEMBER_ROLE, MEMBER_STATUS, type FeedPost } from '../../../lib/social';

interface MyGroup {
  role: string;
  status: string;
  group: { id: string; slug: string; name: string; status: string; visibility: string };
}

const GROUP_STATUS: Record<string, string> = {
  pending: 'на проверке',
  rejected: 'отклонена',
  archived: 'в архиве',
};

export default function MyGroupsPage() {
  const [data, setData] = useState<{ groups: MyGroup[]; posts: FeedPost[] } | null>();
  useEffect(() => {
    void Promise.all([
      apiRequest<MyGroup[]>('/api/me/groups'),
      apiRequest<FeedPost[]>('/api/me/posts'),
    ]).then(([g, p]) =>
      setData(g.ok && p.ok && g.data && p.data ? { groups: g.data, posts: p.data } : null),
    );
  }, []);

  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Мои группы и посты"
        crumbs={[{ label: 'Кабинет', href: '/account' }, { label: 'Мои группы и посты' }]}
      />
      {data === undefined ? (
        <Skeleton height="8rem" />
      ) : data === null ? (
        <EmptyState
          title="Нужен вход"
          description="Войдите, чтобы увидеть свои группы и посты."
          action={<Link href="/login?next=/groups/mine">Войти</Link>}
        />
      ) : (
        <>
          <h2>Группы</h2>
          {data.groups.length === 0 ? (
            <EmptyState
              title="Вы пока не состоите в группах"
              description="Найдите группу по интересам или создайте свою."
              action={<Link href="/groups">Все группы</Link>}
            />
          ) : (
            <div className={social.list}>
              {data.groups.map((g) => (
                <Card key={g.group.id}>
                  <Link href={`/groups/${g.group.slug}`}>{g.group.name}</Link>{' '}
                  <Badge>
                    {g.status === 'active' ? MEMBER_ROLE[g.role] : MEMBER_STATUS[g.status]}
                  </Badge>{' '}
                  {GROUP_STATUS[g.group.status] && (
                    <Badge tone="warning">{GROUP_STATUS[g.group.status]}</Badge>
                  )}
                </Card>
              ))}
            </div>
          )}
          <h2>Посты</h2>
          {data.posts.length === 0 ? (
            <EmptyState
              title="Вы ещё не публиковали посты"
              description="Напишите пост в ленте или в группе."
            />
          ) : (
            <div className={social.list}>
              {data.posts.map((p) => (
                <div key={p.id}>
                  <PostCard post={p} signedIn detail />
                  <Link href={`/feed/${p.id}`}>Открыть</Link>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
