'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Alert, Card, Skeleton } from '../../../components/ui/Feedback';
import { TextField } from '../../../components/ui/Field';
import { useApi } from '../../../components/admin/useApi';
import { apiRequest, errorMessage } from '../../../lib/auth-client';
import styles from '../../../components/admin/admin.module.css';

interface SettingItem {
  key: string;
  group: string;
  label: string;
  hint: string;
  min: number;
  max: number;
  default: number;
  value: number;
}

export default function SettingsPage() {
  const { data, error, reload } = useApi<{ items: SettingItem[] }>('/api/admin/settings');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string }>();
  const [saving, setSaving] = useState(false);

  const groups = new Map<string, SettingItem[]>();
  for (const item of data?.items ?? [])
    groups.set(item.group, [...(groups.get(item.group) ?? []), item]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const values = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, Number(v)]));
    setSaving(true);
    const r = await apiRequest('/api/admin/settings', { method: 'PATCH', body: { values } });
    setSaving(false);
    setStatus(
      r.ok ? { tone: 'success', text: 'Сохранено.' } : { tone: 'error', text: errorMessage(r) },
    );
    if (r.ok) {
      setDraft({});
      reload();
    }
  }

  return (
    <>
      <div className={styles.head}>
        <h1>Настройки</h1>
      </div>
      <p>
        Правила работы разделов. Включить или выключить раздел целиком можно в{' '}
        <Link href="/admin/integrations">«Функциях и интеграциях»</Link>, рубрики — в{' '}
        <Link href="/admin/categories">«Категориях»</Link>.
      </p>
      {error && <Alert tone="error" title={error} />}
      {!data && !error && <Skeleton height="8rem" />}
      {data && (
        <form className={styles.form} onSubmit={(e) => void submit(e)}>
          {status && <Alert tone={status.tone} title={status.text} />}
          {[...groups].map(([group, items]) => (
            <Card key={group}>
              <h2>{group}</h2>
              <div className={styles.form}>
                {items.map((item) => (
                  <TextField
                    key={item.key}
                    label={item.label}
                    hint={`${item.hint} От ${item.min} до ${item.max}, по умолчанию ${item.default}.`}
                    type="number"
                    inputMode="numeric"
                    min={item.min}
                    max={item.max}
                    required
                    value={draft[item.key] ?? String(item.value)}
                    onChange={(e) => setDraft({ ...draft, [item.key]: e.target.value })}
                  />
                ))}
              </div>
            </Card>
          ))}
          <div className={styles.stickyActions}>
            <Button type="submit" disabled={saving || Object.keys(draft).length === 0}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
