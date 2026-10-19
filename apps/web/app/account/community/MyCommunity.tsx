'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { PageHead, styles } from '../../../components/content/Blocks';
import { Button, ButtonLink } from '../../../components/ui/Button';
import { Alert, Badge, Card, EmptyState, Skeleton } from '../../../components/ui/Feedback';
import { apiRequest, errorMessage } from '../../../lib/auth-client';
import { ISSUE_STATUS, LF_KIND, POST_STATUS } from '../../../lib/community';
import { formatDate } from '../../../lib/content';
import { IssueTimeline, type IssueUpdateView } from '../../issues/IssueTimeline';

interface Post {
  id: string;
  slug: string;
  title: string;
  status: string;
  moderationNote: string | null;
  kind?: 'lost' | 'found';
  expiresAt: string;
  createdAt: string;
}
interface Issue {
  id: string;
  number: number;
  title: string;
  status: string;
  isPublic: boolean;
  createdAt: string;
}
interface Inquiry {
  id: string;
  message: string;
  status: string;
  reply: string | null;
  createdAt: string;
  organization: { name: string; slug: string; status: string };
}
interface Data {
  jobs: Post[];
  lostFound: Post[];
  issues: Issue[];
  inquiries: Inquiry[];
}

export function MyCommunity() {
  const router = useRouter();
  const sp = useSearchParams();
  const [data, setData] = useState<Data>();
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState<{ id: string; updates: IssueUpdateView[] }>();

  const load = useCallback(async () => {
    const [jobs, lostFound, issues, inquiries] = await Promise.all([
      apiRequest<Post[]>('/api/me/jobs'),
      apiRequest<Post[]>('/api/me/lost-found'),
      apiRequest<Issue[]>('/api/me/issues'),
      apiRequest<Inquiry[]>('/api/me/inquiries'),
    ]);
    if (jobs.status === 401) return router.replace('/login');
    const failed = [jobs, lostFound, issues, inquiries].find((r) => !r.ok);
    if (failed) return setError(errorMessage(failed));
    setData({
      jobs: jobs.data!,
      lostFound: lostFound.data!,
      issues: issues.data!,
      inquiries: inquiries.data!,
    });
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function finish(path: string, action: 'close' | 'resolve') {
    const text =
      action === 'resolve'
        ? 'Отметить, что всё нашлось?'
        : 'Снять публикацию? Вернуть её будет нельзя.';
    if (!window.confirm(text)) return;
    const r = await apiRequest(`/api/${path}/${action}`, { body: {} });
    if (!r.ok) setError(errorMessage(r));
    await load();
  }

  async function history(id: string) {
    if (open?.id === id) return setOpen(undefined);
    const r = await apiRequest<{ updates: IssueUpdateView[] }>(`/api/me/issues/${id}`);
    if (!r.ok || !r.data) return setError(errorMessage(r));
    setOpen({ id, updates: r.data.updates });
  }

  const posts = (title: string, path: 'jobs' | 'lost-found', items: Post[], add: string) => (
    <section>
      <h2>{title}</h2>
      {items.length === 0 ? (
        <EmptyState
          title="Пока ничего нет"
          description=""
          action={<ButtonLink href={add}>Добавить</ButtonLink>}
        />
      ) : (
        items.map((p) => (
          <Card key={p.id}>
            <div className={styles.meta}>
              <Badge tone={POST_STATUS[p.status]?.tone}>
                {POST_STATUS[p.status]?.label ?? p.status}
              </Badge>
              {p.kind && <Badge>{LF_KIND[p.kind]}</Badge>}
              <span>до {formatDate(p.expiresAt)}</span>
            </div>
            <h3 className={styles.cardTitle}>
              {p.status === 'published' ? (
                <Link href={`/${path}/${p.slug}`}>{p.title}</Link>
              ) : (
                p.title
              )}
            </h3>
            {p.moderationNote && (
              <p className={styles.excerpt}>Комментарий модератора: {p.moderationNote}</p>
            )}
            <div className={styles.meta}>
              {path === 'lost-found' && p.status === 'published' && (
                <Button size="sm" onClick={() => void finish(`${path}/${p.id}`, 'resolve')}>
                  Нашлось
                </Button>
              )}
              {['pending', 'published', 'rejected'].includes(p.status) && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void finish(`${path}/${p.id}`, 'close')}
                >
                  Снять
                </Button>
              )}
            </div>
          </Card>
        ))
      )}
    </section>
  );

  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Мои обращения и публикации"
        crumbs={[{ label: 'Кабинет', href: '/account' }, { label: 'Обращения и публикации' }]}
      />
      {sp.get('issue') && (
        <Alert
          tone="success"
          title={`Обращение № ${sp.get('issue')} отправлено. Статус и ответы появятся здесь.`}
        />
      )}
      {sp.get('saved') === 'pending' && (
        <Alert tone="info" title="Отправлено на проверку модератору." />
      )}
      {sp.get('saved') === 'published' && <Alert tone="success" title="Опубликовано." />}
      {error && <Alert tone="error" title={error} />}
      {!data && !error && <Skeleton height="12rem" />}
      {data && (
        <div className={styles.list}>
          <section>
            <h2>Обращения</h2>
            {data.issues.length === 0 ? (
              <EmptyState
                title="Обращений нет"
                description=""
                action={<ButtonLink href="/issues/new">Сообщить о проблеме</ButtonLink>}
              />
            ) : (
              data.issues.map((i) => (
                <Card key={i.id}>
                  <div className={styles.meta}>
                    <Badge tone={ISSUE_STATUS[i.status]?.tone}>
                      {ISSUE_STATUS[i.status]?.label}
                    </Badge>
                    <span>{i.isPublic ? 'видно всем' : 'приватное'}</span>
                    <span>{formatDate(i.createdAt)}</span>
                  </div>
                  <h3 className={styles.cardTitle}>
                    № {i.number}. {i.title}
                  </h3>
                  <Button size="sm" variant="secondary" onClick={() => void history(i.id)}>
                    {open?.id === i.id ? 'Скрыть историю' : 'История и ответы'}
                  </Button>
                  {open?.id === i.id && <IssueTimeline updates={open.updates} />}
                </Card>
              ))
            )}
          </section>
          {posts('Вакансии', 'jobs', data.jobs, '/jobs/new')}
          {posts('Потеряно и найдено', 'lost-found', data.lostFound, '/lost-found/new')}
          <section>
            <h2>Заявки организациям</h2>
            {data.inquiries.length === 0 ? (
              <p className={styles.excerpt}>Вы ещё не отправляли заявок.</p>
            ) : (
              data.inquiries.map((q) => (
                <Card key={q.id}>
                  <div className={styles.meta}>
                    <Badge tone={q.reply ? 'success' : 'warning'}>
                      {q.reply ? 'Есть ответ' : 'Ждёт ответа'}
                    </Badge>
                    <span>{formatDate(q.createdAt)}</span>
                  </div>
                  <h3 className={styles.cardTitle}>
                    {q.organization.status === 'published' ? (
                      <Link href={`/organizations/${q.organization.slug}`}>
                        {q.organization.name}
                      </Link>
                    ) : (
                      q.organization.name
                    )}
                  </h3>
                  <p className={styles.excerpt}>{q.message}</p>
                  {q.reply && <p>Ответ: {q.reply}</p>}
                </Card>
              ))
            )}
          </section>
        </div>
      )}
    </main>
  );
}
