import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LoadError, PageHead, styles } from '../../../components/content/Blocks';
import { Badge } from '../../../components/ui/Feedback';
import { ISSUE_CATEGORIES, ISSUE_STATUS } from '../../../lib/community';
import { apiGet, formatDate, paragraphs } from '../../../lib/content';
import { IssueTimeline, type IssueUpdateView } from '../IssueTimeline';

export const dynamic = 'force-dynamic';

interface Issue {
  number: number;
  category: string;
  title: string;
  description: string;
  address: string | null;
  imageIds: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
  updates: IssueUpdateView[];
}
type Props = { params: Promise<{ number: string }> };
const load = async (p: Props) => {
  const n = (await p.params).number;
  return /^\d{1,9}$/.test(n)
    ? apiGet<Issue>(`/api/issues/${n}`)
    : ({ ok: false, status: 404 } as const);
};

export async function generateMetadata(p: Props): Promise<Metadata> {
  const res = await load(p);
  return { title: res.ok ? `Обращение № ${res.data.number}` : 'Обращение' };
}

export default async function IssuePage(p: Props) {
  const res = await load(p);
  if (!res.ok && res.status === 404) notFound();
  if (!res.ok)
    return (
      <main id="main" className={`container ${styles.page}`}>
        <LoadError />
      </main>
    );
  const i = res.data;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <article className={styles.article}>
        <PageHead
          title=""
          crumbs={[{ label: 'Обращения', href: '/issues' }, { label: `№ ${i.number}` }]}
        />
        <div className={styles.meta}>
          <Badge tone={ISSUE_STATUS[i.status]?.tone}>{ISSUE_STATUS[i.status]?.label}</Badge>
          <Badge>{ISSUE_CATEGORIES[i.category]}</Badge>
        </div>
        <h1>
          № {i.number}. {i.title}
        </h1>
        {i.imageIds.length > 0 && (
          <div className={styles.gallery}>
            {i.imageIds.map((id, n) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={id} src={`/api/media/${id}`} alt={`Фото ${n + 1}`} loading="lazy" />
            ))}
          </div>
        )}
        <div className={styles.body}>
          {paragraphs(i.description).map((t, n) => (
            <p key={n}>{t}</p>
          ))}
        </div>
        <dl className={styles.facts}>
          {i.address && (
            <>
              <dt>Место</dt>
              <dd>{i.address}</dd>
            </>
          )}
          <dt>Принято</dt>
          <dd>{formatDate(i.createdAt, true)}</dd>
          <dt>Обновлено</dt>
          <dd>{formatDate(i.updatedAt, true)}</dd>
        </dl>
        <h2>История</h2>
        <IssueTimeline updates={i.updates} />
      </article>
    </main>
  );
}
