import type { Metadata } from 'next';
import { Badge } from '../../components/ui/Feedback';
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
import { LF_KIND, LF_SUBJECT } from '../../lib/community';
import { apiGet, formatDate, pageParam, param, query, type Paged } from '../../lib/content';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Потеряно и найдено',
  description: 'Бюро находок посёлка: потерянные и найденные вещи и животные.',
};

interface LfItem {
  id: string;
  slug: string;
  kind: 'lost' | 'found';
  subject: 'item' | 'animal';
  title: string;
  area: string | null;
  happenedOn: string | null;
  imageIds: string[];
  publishedAt: string;
}

export default async function LostFoundPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const kind = param(sp, 'kind');
  const subject = param(sp, 'subject');
  const page = pageParam(sp);
  const list = await apiGet<Paged<LfItem>>(`/api/lost-found${query({ kind, subject, page })}`);
  const add = <ButtonLink href="/lost-found/new">Сообщить о потере или находке</ButtonLink>;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Потеряно и найдено"
        description="Объявления проверяет модератор. Через 60 дней объявление уходит в архив; автор может отметить «нашлось» раньше."
        crumbs={[{ label: 'Потеряно и найдено' }]}
        action={add}
      />
      <form method="get" action="/lost-found" className={styles.filters}>
        <Select label="Тип" name="kind" defaultValue={kind ?? ''}>
          <option value="">Все</option>
          {Object.entries(LF_KIND).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Select label="Раздел" name="subject" defaultValue={subject ?? ''}>
          <option value="">Вещи и животные</option>
          {Object.entries(LF_SUBJECT).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
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
          filtered={Boolean(kind || subject)}
          title="Объявлений пока нет"
          description="Если вы что-то потеряли или нашли — расскажите соседям."
          action={add}
        />
      ) : (
        <>
          <div className={styles.list}>
            {list.data.items.map((i) => (
              <ItemCard
                key={i.id}
                href={`/lost-found/${i.slug}`}
                title={i.title}
                badges={
                  <>
                    <Badge tone={i.kind === 'lost' ? 'warning' : 'success'}>
                      {LF_KIND[i.kind]}
                    </Badge>
                    <Badge>{LF_SUBJECT[i.subject]}</Badge>
                  </>
                }
                meta={
                  <>
                    {i.area && <span>{i.area}</span>}
                    <span>{formatDate(i.happenedOn ?? i.publishedAt)}</span>
                  </>
                }
              />
            ))}
          </div>
          <Pager
            path="/lost-found"
            page={page}
            total={list.data.total}
            limit={list.data.limit}
            params={{ kind, subject }}
          />
        </>
      )}
    </main>
  );
}
