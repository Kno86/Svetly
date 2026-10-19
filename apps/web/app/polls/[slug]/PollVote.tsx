'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Feedback';
import { Radio } from '../../../components/ui/Field';
import { apiRequest, errorMessage } from '../../../lib/auth-client';
import { percent } from '../../../lib/community';
import styles from '../../../components/content/content.module.css';

export interface PollResults {
  total: number;
  options: Array<{ optionId: string; label: string; votes: number }>;
}

export function Results({ results, mine }: { results: PollResults; mine?: string | null }) {
  return (
    <div className={styles.body}>
      <h2>Результаты (ответов: {results.total})</h2>
      <ul>
        {results.options.map((o) => (
          <li key={o.optionId}>
            {o.label}: {o.votes} ({percent(o.votes, results.total)}%)
            {mine === o.optionId && ' — ваш ответ'}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PollVote({
  slug,
  phase,
  options,
  closedResults,
  allowRevote,
}: {
  slug: string;
  phase: 'upcoming' | 'open' | 'closed';
  options: Array<{ id: string; label: string }>;
  closedResults: PollResults | null;
  allowRevote: boolean;
}) {
  const [state, setState] = useState<'loading' | 'anonymous' | 'ready'>('loading');
  const [mine, setMine] = useState<string | null>(null);
  const [results, setResults] = useState<PollResults | null>(closedResults);
  const [choice, setChoice] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiRequest<{ optionId: string | null; results: PollResults | null }>(
      `/api/polls/${encodeURIComponent(slug)}/me`,
    ).then((r) => {
      if (cancelled) return;
      if (r.status === 401) return setState('anonymous');
      if (r.ok && r.data) {
        setMine(r.data.optionId);
        if (r.data.results) setResults(r.data.results);
      }
      setState('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function vote() {
    setBusy(true);
    setError(undefined);
    const r = await apiRequest<{ optionId: string; results: PollResults }>(
      `/api/polls/${encodeURIComponent(slug)}/vote`,
      { body: { optionId: choice } },
    );
    setBusy(false);
    if (!r.ok || !r.data) return setError(errorMessage(r));
    setMine(r.data.optionId);
    setResults(r.data.results);
  }

  const canVote = phase === 'open' && state === 'ready' && (!mine || allowRevote);
  return (
    <section style={{ marginTop: 'var(--space-6)' }}>
      {phase === 'upcoming' && <Alert tone="info" title="Опрос ещё не начался." />}
      {phase === 'open' && state === 'anonymous' && (
        <Alert tone="info" title="Чтобы ответить, войдите">
          Один аккаунт — один ответ. <Link href="/login">Войти</Link>
        </Alert>
      )}
      {error && <Alert tone="error" title={error} />}
      {canVote && (
        <fieldset className={styles.form}>
          <legend>{mine ? 'Изменить ответ' : 'Ваш ответ'}</legend>
          {options.map((o) => (
            <Radio
              key={o.id}
              name="poll-option"
              label={o.label}
              value={o.id}
              checked={choice === o.id}
              onChange={() => setChoice(o.id)}
            />
          ))}
          <div>
            <Button onClick={() => void vote()} disabled={!choice || busy}>
              Ответить
            </Button>
          </div>
        </fieldset>
      )}
      {results ? (
        <Results results={results} mine={mine} />
      ) : (
        phase === 'open' && (
          <p className={styles.excerpt}>
            Результаты откроются после вашего ответа или после закрытия опроса.
          </p>
        )
      )}
    </section>
  );
}
