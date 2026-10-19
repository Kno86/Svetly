import type { Metadata } from 'next';
import { Alert, Badge } from '../../components/ui/Feedback';
import {
  ButtonLink,
  Empty,
  ItemCard,
  LoadError,
  PageHead,
  Pager,
  styles,
} from '../../components/content/Blocks';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Field';
import { ISSUE_CATEGORIES, ISSUE_STATUS } from '../../lib/community';
import { apiGet, formatDate, pageParam, param, query, type Paged } from '../../lib/content';
import { IssueRouting } from './IssueTimeline';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Обращения жителей',
  description: 'Сообщения о проблемах территории: дороги, освещение, мусор, благоустройство.',
};

interface IssueItem {
  number: number;
  category: string;
  title: string;
  address: string | null;
  status: string;
  createdAt: string;
}

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const status = param(sp, 'status');
  const category = param(sp, 'category');
  const page = pageParam(sp);
  const list = await apiGet<Paged<IssueItem>>(`/api/issues${query({ status, category, page })}`);
  const add = <ButtonLink href="/issues/new">Сообщить о проблеме</ButtonLink>;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Обращения жителей"
        description="Здесь показаны только обращения, авторы которых разрешили публикацию. Имена и контакты не публикуются."
        crumbs={[{ label: 'Обращения' }]}
        action={add}
      />
      <Alert tone="info" title="Кто получает обращение">
        <IssueRouting />
      </Alert>
      <form method="get" action="/issues" className={styles.filters}>
        <Select label="Категория" name="category" defaultValue={category ?? ''}>
          <option value="">Все</option>
          {Object.entries(ISSUE_CATEGORIES).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Select label="Статус" name="status" defaultValue={status ?? ''}>
          <option value="">Любой</option>
          {Object.entries(ISSUE_STATUS)
            .filter(([v]) => v !== 'rejected')
            .map(([v, s]) => (
              <option key={v} value={v}>
                {s.label}
              </option>
            ))}
        </Select>
        <Button type="submit" variant="secondary">
          Показать
        </Button>
      </form>
      {!list.ok ? (
        <LoadError />
      ) : list.data.items.length === 0 ? (
        <Empty
          filtered={Boolean(status || category)}
          title="Публичных обращений пока нет"
          description="Сообщите о проблеме — вы сами решаете, показывать ли обращение другим жителям."
          action={add}
        />
      ) : (
        <>
          <div className={styles.list}>
            {list.data.items.map((i) => (
              <ItemCard
                key={i.number}
                href={`/issues/${i.number}`}
                title={`№ ${i.number}. ${i.title}`}
                badges={
                  <>
                    <Badge tone={ISSUE_STATUS[i.status]?.tone}>
                      {ISSUE_STATUS[i.status]?.label}
                    </Badge>
                    <Badge>{ISSUE_CATEGORIES[i.category]}</Badge>
                  </>
                }
                meta={
                  <>
                    {i.address && <span>{i.address}</span>}
                    <time dateTime={i.createdAt}>{formatDate(i.createdAt)}</time>
                  </>
                }
              />
            ))}
          </div>
          <Pager
            path="/issues"
            page={page}
            total={list.data.total}
            limit={list.data.limit}
            params={{ status, category }}
          />
        </>
      )}
    </main>
  );
}
