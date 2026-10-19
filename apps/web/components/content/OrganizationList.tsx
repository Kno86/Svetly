import { Badge } from '../ui/Feedback';
import { Empty, Filters, ItemCard, LoadError, PageHead, Pager, styles } from './Blocks';
import {
  apiGet,
  pageParam,
  param,
  query,
  type Category,
  type CategoryRef,
  type Paged,
} from '../../lib/content';

interface Org {
  id: string;
  slug: string;
  kind: 'organization' | 'service';
  name: string;
  description: string;
  address: string | null;
  serviceArea: string | null;
  verification: 'unverified' | 'verified';
  isDemo: boolean;
  category: CategoryRef | null;
}

export function VerificationBadge({ value }: { value: 'unverified' | 'verified' }) {
  return value === 'verified' ? (
    <Badge tone="success">Данные проверены</Badge>
  ) : (
    <Badge>Не проверено</Badge>
  );
}

export async function OrganizationList({
  kind,
  path,
  title,
  description,
  sp,
}: {
  kind: 'organization' | 'service';
  path: string;
  title: string;
  description: string;
  sp: Record<string, string | string[] | undefined>;
}) {
  const q = param(sp, 'q');
  const category = param(sp, 'category');
  const page = pageParam(sp);
  const [list, cats] = await Promise.all([
    apiGet<Paged<Org>>(`/api/organizations${query({ kind, q, category, page })}`),
    apiGet<Category[]>(
      `/api/categories?module=${kind === 'service' ? 'services' : 'organizations'}`,
    ),
  ]);
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead title={title} description={description} crumbs={[{ label: title }]} />
      <Filters action={path} q={q} category={category} categories={cats.ok ? cats.data : []} />
      {!list.ok ? (
        <LoadError />
      ) : list.data.items.length === 0 ? (
        <Empty
          filtered={Boolean(q || category)}
          title="Карточек пока нет"
          description="Карточки добавляет редакция только по проверенным данным. Кабинет предпринимателя появится в следующих фазах."
        />
      ) : (
        <>
          <div className={styles.list}>
            {list.data.items.map((o) => (
              <ItemCard
                key={o.id}
                href={`/organizations/${o.slug}`}
                title={o.name}
                badges={
                  <>
                    {o.category && <Badge>{o.category.name}</Badge>}
                    <VerificationBadge value={o.verification} />
                    {o.isDemo && <Badge tone="warning">демо</Badge>}
                  </>
                }
                meta={(o.address ?? o.serviceArea) && <span>{o.address ?? o.serviceArea}</span>}
              >
                <p className={styles.excerpt}>{o.description.slice(0, 160)}</p>
              </ItemCard>
            ))}
          </div>
          <Pager
            path={path}
            page={page}
            total={list.data.total}
            limit={list.data.limit}
            params={{ q, category }}
          />
        </>
      )}
    </main>
  );
}
