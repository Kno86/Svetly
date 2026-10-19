'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PageHead, styles } from '../../components/content/Blocks';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Feedback';
import { Composer } from '../../components/social/Composer';
import { FeedList } from '../../components/social/FeedList';
import { useSignedIn } from '../../components/social/useSignedIn';

export function FeedView() {
  const signedIn = useSignedIn();
  const [scope, setScope] = useState<'all' | 'groups'>('all');
  const [version, setVersion] = useState(0);
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Лента"
        description="Посты жителей и открытых групп, новые сверху. Лента обновляется при открытии страницы и по кнопке «Обновить»."
        crumbs={[{ label: 'Лента' }]}
      />
      {signedIn === false && (
        <p>
          <Link href="/login?next=/feed">Войдите</Link>, чтобы публиковать посты, ставить отметки и
          комментировать.
        </p>
      )}
      {signedIn && (
        <Card>
          <Composer onPosted={() => setVersion((v) => v + 1)} />
        </Card>
      )}
      {signedIn && (
        <div role="group" aria-label="Что показывать" className={styles.filters}>
          <Button
            size="sm"
            variant={scope === 'all' ? 'primary' : 'secondary'}
            aria-pressed={scope === 'all'}
            onClick={() => setScope('all')}
          >
            Все посты
          </Button>
          <Button
            size="sm"
            variant={scope === 'groups' ? 'primary' : 'secondary'}
            aria-pressed={scope === 'groups'}
            onClick={() => setScope('groups')}
          >
            Мои группы
          </Button>
        </div>
      )}
      {signedIn !== undefined && (
        <FeedList
          path={`/api/feed?scope=${scope}`}
          signedIn={signedIn}
          version={version}
          empty={
            scope === 'groups'
              ? {
                  title: 'В ваших группах пока нет постов',
                  description: 'Вступите в группу или напишите первый пост в своей.',
                }
              : {
                  title: 'Постов пока нет',
                  description: 'Лента наполняется постами жителей. Станьте первым автором.',
                }
          }
        />
      )}
    </main>
  );
}
