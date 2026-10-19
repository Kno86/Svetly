'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PageHead, styles } from '../../../components/content/Blocks';
import { ReportButton } from '../../../components/content/ReportButton';
import { Composer } from '../../../components/social/Composer';
import { FeedList } from '../../../components/social/FeedList';
import social from '../../../components/social/social.module.css';
import { Button } from '../../../components/ui/Button';
import { Alert, Badge, Card, EmptyState, Skeleton } from '../../../components/ui/Feedback';
import { apiRequest, errorMessage } from '../../../lib/auth-client';
import { formatDate, paragraphs } from '../../../lib/content';
import { GROUP_TOPICS, MEMBER_ROLE, MEMBER_STATUS } from '../../../lib/social';

interface Group {
  id: string;
  slug: string;
  name: string;
  description: string;
  rules: string;
  topic: string;
  visibility: 'open' | 'closed';
  status: string;
  moderationNote?: string | null;
  members: number;
  membership: { role: string; status: string } | null;
  canRead: boolean;
}
interface Member {
  userId: string;
  role: string;
  status: string;
  createdAt: string;
  user: { name: string };
}

const GROUP_STATUS: Record<string, string> = {
  pending: 'Группа ждёт проверки модератором и пока не видна другим жителям.',
  rejected: 'Группа отклонена модератором.',
  archived: 'Группа в архиве.',
};

export function GroupView({ slug }: { slug: string }) {
  const [group, setGroup] = useState<Group | null>();
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState<string>();
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    const [r, me] = await Promise.all([
      apiRequest<Group>(`/api/groups/${slug}`),
      apiRequest('/api/me'),
    ]);
    setSignedIn(me.ok);
    setGroup(r.ok && r.data ? r.data : null);
  }, [slug]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function act(path: string) {
    const r = await apiRequest(path, { body: {} });
    if (!r.ok) return setError(errorMessage(r));
    setError(undefined);
    await load();
    setVersion((v) => v + 1);
  }

  if (group === undefined)
    return (
      <main id="main" className={`container ${styles.page}`}>
        <Skeleton height="10rem" />
      </main>
    );
  if (group === null)
    return (
      <main id="main" className={`container ${styles.page}`}>
        <EmptyState
          title="Группа не найдена"
          description="Возможно, она ещё не прошла проверку или удалена."
        />
      </main>
    );

  const m = group.membership;
  const manager = m?.status === 'active' && (m.role === 'owner' || m.role === 'moderator');
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title={group.name}
        description={`${GROUP_TOPICS[group.topic] ?? group.topic} · ${group.visibility === 'open' ? 'открытая' : 'закрытая'} группа · участников: ${group.members}`}
        crumbs={[{ label: 'Группы', href: '/groups' }, { label: group.name }]}
      />
      {GROUP_STATUS[group.status] && (
        <Alert tone="warning" title={GROUP_STATUS[group.status]!}>
          {group.moderationNote && <p>Комментарий модератора: {group.moderationNote}</p>}
        </Alert>
      )}
      {error && <Alert tone="error" title={error} />}
      <Card>
        {paragraphs(group.description).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {group.rules && (
          <details>
            <summary>Правила группы</summary>
            {paragraphs(group.rules).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </details>
        )}
        <div className={social.actions}>
          {m && (
            <Badge tone={m.status === 'banned' ? 'error' : 'info'}>
              {m.status === 'active' ? MEMBER_ROLE[m.role] : MEMBER_STATUS[m.status]}
            </Badge>
          )}
          {group.status === 'active' && !m && signedIn && (
            <Button size="sm" onClick={() => void act(`/api/groups/${slug}/join`)}>
              {group.visibility === 'open' ? 'Вступить' : 'Подать заявку'}
            </Button>
          )}
          {!signedIn && <Link href={`/login?next=/groups/${slug}`}>Войдите, чтобы вступить</Link>}
          {m && m.role !== 'owner' && m.status !== 'banned' && (
            <Button size="sm" variant="ghost" onClick={() => void act(`/api/groups/${slug}/leave`)}>
              {m.status === 'pending' ? 'Отозвать заявку' : 'Выйти'}
            </Button>
          )}
          {group.status === 'active' && signedIn && !m && (
            <ReportButton entityType="group" entityId={group.id} />
          )}
        </div>
      </Card>
      {manager && <Members slug={slug} owner={m.role === 'owner'} onChange={load} />}
      {m?.status === 'active' && group.status === 'active' && (
        <Card>
          <Composer groupId={group.id} onPosted={() => setVersion((v) => v + 1)} />
        </Card>
      )}
      {group.status === 'active' &&
        (group.canRead ? (
          <FeedList
            path={`/api/groups/${slug}/posts`}
            signedIn={signedIn}
            version={version}
            empty={{
              title: 'В группе пока нет постов',
              description: 'Участники могут написать первый пост.',
            }}
          />
        ) : (
          <EmptyState
            title="Материалы видны только участникам"
            description="Подайте заявку, и её рассмотрит владелец или модератор группы."
          />
        ))}
    </main>
  );
}

function Members({
  slug,
  owner,
  onChange,
}: {
  slug: string;
  owner: boolean;
  onChange: () => Promise<void>;
}) {
  const [list, setList] = useState<Member[]>();
  const [error, setError] = useState<string>();
  const load = useCallback(async () => {
    const r = await apiRequest<Member[]>(`/api/groups/${slug}/members`);
    if (r.ok && r.data) setList(r.data);
  }, [slug]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function act(userId: string, action: string) {
    const r = await apiRequest(`/api/groups/${slug}/members/${userId}/${action}`, { body: {} });
    setError(r.ok ? undefined : errorMessage(r));
    await load();
    await onChange();
  }
  const pending = list?.filter((x) => x.status === 'pending').length ?? 0;
  return (
    <Card>
      <details>
        <summary>Участники{pending ? ` · заявок: ${pending}` : ''}</summary>
        {error && <Alert tone="error" title={error} />}
        {list?.map((x) => (
          <div key={x.userId} className={social.comment}>
            <div className={social.meta}>
              <strong>{x.user.name}</strong>
              <span>{x.status === 'active' ? MEMBER_ROLE[x.role] : MEMBER_STATUS[x.status]}</span>
              <span>с {formatDate(x.createdAt)}</span>
            </div>
            {x.role !== 'owner' && (
              <div className={social.actions}>
                {x.status === 'pending' && (
                  <Button size="sm" onClick={() => void act(x.userId, 'approve')}>
                    Принять
                  </Button>
                )}
                {x.status === 'pending' && (
                  <Button size="sm" variant="ghost" onClick={() => void act(x.userId, 'remove')}>
                    Отклонить
                  </Button>
                )}
                {x.status === 'active' && owner && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void act(x.userId, x.role === 'moderator' ? 'demote' : 'promote')
                    }
                  >
                    {x.role === 'moderator' ? 'Снять модератора' : 'Сделать модератором'}
                  </Button>
                )}
                {x.status === 'active' && (owner || x.role === 'member') && (
                  <Button size="sm" variant="ghost" onClick={() => void act(x.userId, 'remove')}>
                    Исключить
                  </Button>
                )}
                {x.status !== 'banned' && (owner || x.role === 'member') && (
                  <Button size="sm" variant="danger" onClick={() => void act(x.userId, 'ban')}>
                    Заблокировать
                  </Button>
                )}
                {x.status === 'banned' && (
                  <Button size="sm" variant="secondary" onClick={() => void act(x.userId, 'unban')}>
                    Разблокировать
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </details>
    </Card>
  );
}
