'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { PageHead, styles } from '../../../components/content/Blocks';
import { Button } from '../../../components/ui/Button';
import { Alert, Card } from '../../../components/ui/Feedback';
import { Select, TextArea, TextField } from '../../../components/ui/Field';
import { apiRequest, errorMessage } from '../../../lib/auth-client';
import { GROUP_TOPICS, GROUP_VISIBILITY } from '../../../lib/social';

export default function NewGroupPage() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const r = await apiRequest<{ slug: string }>('/api/groups', {
      body: Object.fromEntries(
        ['name', 'description', 'rules', 'topic', 'visibility'].map((k) => [k, f.get(k)]),
      ),
    });
    setBusy(false);
    if (r.status === 401) return router.push('/login?next=/groups/new');
    if (!r.ok || !r.data) return setError(errorMessage(r));
    router.push(`/groups/${r.data.slug}`);
  }

  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Новая группа"
        description="Вы станете владельцем группы. Она появится в общем списке после проверки модератором."
        crumbs={[{ label: 'Группы', href: '/groups' }, { label: 'Новая группа' }]}
      />
      <Card>
        <form className={styles.form} onSubmit={(e) => void submit(e)}>
          <TextField label="Название" name="name" required minLength={3} maxLength={80} />
          <TextArea
            label="Описание"
            name="description"
            required
            minLength={10}
            maxLength={2000}
            rows={4}
          />
          <TextArea
            label="Правила (необязательно)"
            name="rules"
            maxLength={3000}
            rows={4}
            hint="Правила видят все, кто открывает группу."
          />
          <Select label="Тема" name="topic" required defaultValue="neighbors">
            {Object.entries(GROUP_TOPICS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          <Select label="Доступ" name="visibility" defaultValue="open">
            {Object.entries(GROUP_VISIBILITY).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          {error && <Alert tone="error" title={error} />}
          <div>
            <Button type="submit" loading={busy}>
              Отправить на проверку
            </Button>
          </div>
        </form>
      </Card>
    </main>
  );
}
