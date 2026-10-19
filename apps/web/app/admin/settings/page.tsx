'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Alert, Card, Skeleton } from '../../../components/ui/Feedback';
import { TextField } from '../../../components/ui/Field';
import { useApi } from '../../../components/admin/useApi';
import { apiRequest, errorMessage } from '../../../lib/auth-client';
import styles from '../../../components/admin/admin.module.css';

export default function SettingsPage() {
  const { data, error, reload } = useApi<{ trustedThreshold: number }>('/api/admin/settings');
  const [value, setValue] = useState<string>();
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string }>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = await apiRequest('/api/admin/settings', {
      method: 'PATCH',
      body: { trustedThreshold: Number(value ?? data?.trustedThreshold) },
    });
    setStatus(
      r.ok ? { tone: 'success', text: 'Сохранено.' } : { tone: 'error', text: errorMessage(r) },
    );
    if (r.ok) reload();
  }

  return (
    <>
      <div className={styles.head}>
        <h1>Настройки</h1>
      </div>
      {error && <Alert tone="error" title={error} />}
      {!data && !error && <Skeleton height="8rem" />}
      {data && (
        <Card>
          <form className={styles.form} onSubmit={submit}>
            <h2>Премодерация объявлений</h2>
            {status && <Alert tone={status.tone} title={status.text} />}
            <TextField
              label="Порог доверия"
              hint="Сколько одобренных объявлений без отклонений нужно автору, чтобы публиковать без проверки. 0 — без премодерации."
              type="number"
              min={0}
              max={50}
              required
              value={value ?? String(data.trustedThreshold)}
              onChange={(e) => setValue(e.target.value)}
            />
            <div>
              <Button type="submit">Сохранить</Button>
            </div>
          </form>
        </Card>
      )}
    </>
  );
}
