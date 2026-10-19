import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LoadError, PageHead, styles } from '../../../components/content/Blocks';
import { Alert, Badge } from '../../../components/ui/Feedback';
import { POLL_MODE, POLL_PHASE } from '../../../lib/community';
import { apiGet, formatDate, paragraphs } from '../../../lib/content';
import { PollVote, type PollResults } from './PollVote';

export const dynamic = 'force-dynamic';

interface Poll {
  slug: string;
  title: string;
  description: string;
  mode: 'anonymous' | 'identified';
  allowRevote: boolean;
  opensAt: string;
  closesAt: string;
  phase: 'upcoming' | 'open' | 'closed';
  options: Array<{ id: string; label: string }>;
  results: PollResults | null;
}
type Props = { params: Promise<{ slug: string }> };
const load = async (p: Props) =>
  apiGet<Poll>(`/api/polls/${encodeURIComponent((await p.params).slug)}`);

export async function generateMetadata(p: Props): Promise<Metadata> {
  const res = await load(p);
  return { title: res.ok ? res.data.title : 'Опрос' };
}

export default async function PollPage(p: Props) {
  const res = await load(p);
  if (!res.ok && res.status === 404) notFound();
  if (!res.ok)
    return (
      <main id="main" className={`container ${styles.page}`}>
        <LoadError />
      </main>
    );
  const poll = res.data;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <article className={styles.article}>
        <PageHead title="" crumbs={[{ label: 'Опросы', href: '/polls' }, { label: poll.title }]} />
        <div className={styles.meta}>
          <Badge tone={POLL_PHASE[poll.phase].tone}>{POLL_PHASE[poll.phase].label}</Badge>
          <span>
            {formatDate(poll.opensAt, true)} — {formatDate(poll.closesAt, true)}
          </span>
        </div>
        <h1>{poll.title}</h1>
        <div className={styles.body}>
          {paragraphs(poll.description).map((t, i) => (
            <p key={i}>{t}</p>
          ))}
        </div>
        <Alert tone="info" title="Как устроен опрос">
          {POLL_MODE[poll.mode]}{' '}
          {poll.allowRevote ? 'Ответ можно изменить до закрытия.' : 'Ответ изменить нельзя.'} Это не
          официальное голосование.
        </Alert>
        <PollVote
          slug={poll.slug}
          phase={poll.phase}
          options={poll.options}
          closedResults={poll.results}
          allowRevote={poll.allowRevote}
        />
      </article>
    </main>
  );
}
