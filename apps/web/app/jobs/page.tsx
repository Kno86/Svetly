import type { Metadata } from 'next';
import {
  ButtonLink,
  Empty,
  ItemCard,
  LoadError,
  PageHead,
  Pager,
  styles,
} from '../../components/content/Blocks';
import { TextField } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { apiGet, formatDate, pageParam, param, query, type Paged } from '../../lib/content';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Вакансии',
  description: 'Работа в посёлке и рядом: вакансии от работодателей и жителей.',
};

interface JobItem {
  id: string;
  slug: string;
  title: string;
  employer: string;
  salary: string | null;
  schedule: string | null;
  area: string | null;
  publishedAt: string;
  expiresAt: string;
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = param(sp, 'q');
  const page = pageParam(sp);
  const list = await apiGet<Paged<JobItem>>(`/api/jobs${query({ q, page })}`);
  const add = <ButtonLink href="/jobs/new">Разместить вакансию</ButtonLink>;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Вакансии"
        description="Вакансии новых авторов проверяет модератор. Срок размещения — до 60 дней, после чего вакансия уходит в архив."
        crumbs={[{ label: 'Вакансии' }]}
        action={add}
      />
      <form method="get" action="/jobs" className={styles.filters} role="search">
        <TextField
          label="Поиск"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Например, продавец"
        />
        <Button type="submit" variant="secondary">
          Найти
        </Button>
      </form>
      {!list.ok ? (
        <LoadError />
      ) : list.data.items.length === 0 ? (
        <Empty
          filtered={Boolean(q)}
          title="Вакансий пока нет"
          description="Работодатели посёлка могут разместить вакансию бесплатно."
          action={add}
        />
      ) : (
        <>
          <div className={styles.list}>
            {list.data.items.map((j) => (
              <ItemCard
                key={j.id}
                href={`/jobs/${j.slug}`}
                title={j.title}
                meta={
                  <>
                    <span>{j.employer}</span>
                    {j.area && <span>{j.area}</span>}
                    <time dateTime={j.publishedAt}>{formatDate(j.publishedAt)}</time>
                  </>
                }
              >
                {(j.salary || j.schedule) && (
                  <p className={styles.excerpt}>
                    {[j.salary, j.schedule].filter(Boolean).join(' · ')}
                  </p>
                )}
              </ItemCard>
            ))}
          </div>
          <Pager
            path="/jobs"
            page={page}
            total={list.data.total}
            limit={list.data.limit}
            params={{ q }}
          />
        </>
      )}
    </main>
  );
}
