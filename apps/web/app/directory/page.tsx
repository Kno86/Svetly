import { MediaImage } from '../../components/content/MediaImage';
import { RichText } from '../../components/content/RichText';
import type { Metadata } from 'next';
import { Badge } from '../../components/ui/Feedback';
import { Empty, Filters, LoadError, PageHead, styles } from '../../components/content/Blocks';
import {
  apiGet,
  formatDate,
  param,
  query,
  type Category,
  type CategoryRef,
} from '../../lib/content';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Справочник',
  description: 'Полезные телефоны, инструкции и ссылки.',
};

interface Entry {
  imageIds?: string[];
  id: string;
  slug: string;
  title: string;
  kind: 'contact' | 'emergency' | 'instruction' | 'link' | 'document' | 'infrastructure';
  body: string;
  phone: string | null;
  url: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  checkedAt: string | null;
  isDemo: boolean;
  category: CategoryRef | null;
}

const KINDS: Record<Entry['kind'], string> = {
  emergency: 'Экстренные службы',
  contact: 'Контакты',
  instruction: 'Инструкции и правила',
  link: 'Полезные ссылки',
  document: 'Документы',
  infrastructure: 'Инфраструктура',
};

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = param(sp, 'q');
  const category = param(sp, 'category');
  const [list, cats] = await Promise.all([
    apiGet<Entry[]>(`/api/directory${query({ q, category })}`),
    apiGet<Category[]>('/api/categories?module=directory'),
  ]);
  const groups = list.ok
    ? (Object.keys(KINDS) as Entry['kind'][])
        .map((k) => ({ kind: k, items: list.data.filter((e) => e.kind === k) }))
        .filter((g) => g.items.length > 0)
    : [];
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Справочник"
        description="Только записи с указанным источником. При угрозе жизни звоните 112."
        crumbs={[{ label: 'Справочник' }]}
      />
      <Filters
        action="/directory"
        q={q}
        category={category}
        categories={cats.ok ? cats.data : []}
      />
      {!list.ok ? (
        <LoadError />
      ) : groups.length === 0 ? (
        <Empty
          filtered={Boolean(q || category)}
          title="Справочник пока не заполнен"
          description="Редакция добавляет контакты только из официальных и проверенных источников."
        />
      ) : (
        groups.map((g) => (
          <section key={g.kind} className={styles.dirGroup} aria-labelledby={`dir-${g.kind}`}>
            <h2 id={`dir-${g.kind}`}>{KINDS[g.kind]}</h2>
            <div className={styles.list}>
              {g.items.map((e) => (
                <article key={e.id} id={e.slug} className={styles.dirItem}>
                  {e.imageIds?.[0] && (
                    <MediaImage
                      id={e.imageIds[0]}
                      alt=""
                      variant="card"
                      className={styles.cardImage}
                    />
                  )}
                  <h3 className={styles.cardTitle}>
                    {e.title} {e.isDemo && <Badge tone="warning">демо</Badge>}
                  </h3>
                  {e.body && (
                    <div className={styles.excerpt}>
                      <RichText text={e.body} />
                    </div>
                  )}
                  <div className={styles.meta}>
                    {e.phone && <a href={`tel:${e.phone.replace(/[^+0-9]/g, '')}`}>{e.phone}</a>}
                    {e.url && (
                      <a href={e.url} rel="noopener noreferrer nofollow" target="_blank">
                        Перейти на сайт
                      </a>
                    )}
                  </div>
                  <p className={styles.source}>
                    Источник:{' '}
                    {e.sourceName ? (
                      e.sourceUrl ? (
                        <a href={e.sourceUrl} rel="noopener noreferrer nofollow" target="_blank">
                          {e.sourceName}
                        </a>
                      ) : (
                        e.sourceName
                      )
                    ) : (
                      'не указан'
                    )}
                    {e.checkedAt && <> · проверено {formatDate(e.checkedAt)}</>}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}
