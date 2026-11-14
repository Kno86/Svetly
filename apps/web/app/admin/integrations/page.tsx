'use client';

import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Alert, Badge, Card, Skeleton } from '../../../components/ui/Feedback';
import { useApi } from '../../../components/admin/useApi';
import { apiRequest, errorMessage } from '../../../lib/auth-client';
import styles from '../../../components/admin/admin.module.css';

interface Feature {
  key: string;
  label: string;
  owner: string;
  description: string;
  defaultEnabled: boolean;
  dependsOn: string[];
  status: 'available' | 'not_configured' | 'not_implemented';
  enabled: boolean;
  blockedBy?: string;
  section?: boolean;
}
interface Provider {
  key: string;
  label: string;
  status: 'configured' | 'not_configured';
  note?: string;
}
interface Overview {
  environment: string;
  features: Feature[];
  providers: Provider[];
}

const STATUS: Record<Feature['status'], string> = {
  available: 'реализовано',
  not_configured: 'не настроено',
  not_implemented: 'не реализовано',
};

export default function IntegrationsPage() {
  const { data, error, reload } = useApi<Overview>('/api/admin/integrations');
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string }>();

  async function toggle(f: Feature) {
    const r = await apiRequest(`/api/admin/features/${f.key}`, {
      method: 'PATCH',
      body: { enabled: !f.enabled },
    });
    setMessage(
      r.ok
        ? { tone: 'success', text: `«${f.label}»: ${f.enabled ? 'выключено' : 'включено'}.` }
        : { tone: 'error', text: errorMessage(r) },
    );
    if (r.ok) reload();
  }

  return (
    <>
      <div className={styles.head}>
        <h1>Интеграции и функции</h1>
      </div>
      <p>
        Внешние сервисы показаны в том состоянии, в котором они есть на самом деле. Без ключей и
        согласования интеграцию нельзя включить: платформа не имитирует ответы AI и платежи.
      </p>
      {error && <Alert tone="error" title={error} />}
      {message && <Alert tone={message.tone} title={message.text} />}
      {!data && !error && <Skeleton height="16rem" />}
      {data && (
        <>
          <Card>
            <h2>Внешние сервисы</h2>
            <ul>
              {data.providers.map((p) => (
                <li key={p.key} className={styles.item}>
                  <strong>{p.label}</strong>{' '}
                  <Badge tone={p.status === 'configured' ? 'success' : 'neutral'}>
                    {p.status === 'configured' ? 'настроено' : 'не настроено'}
                  </Badge>
                  {p.note && <div>{p.note}</div>}
                </li>
              ))}
            </ul>
          </Card>
          <FeatureList
            title="Разделы сайта"
            note="Выключенный раздел пропадает из меню, с главной, из поиска и карты сайта; его страницы показывают «Раздел временно отключён», API отвечает 404. Записи не удаляются, редакция и модерация продолжают работать."
            features={data.features.filter((f) => f.section)}
            onToggle={toggle}
          />
          <FeatureList
            title="Платформа и интеграции"
            note={`Среда: ${data.environment}.`}
            features={data.features.filter((f) => !f.section)}
            onToggle={toggle}
          />
        </>
      )}
    </>
  );
}

function FeatureList({
  title,
  note,
  features,
  onToggle,
}: {
  title: string;
  note: string;
  features: Feature[];
  onToggle: (f: Feature) => Promise<void>;
}) {
  return (
    <Card>
      <h2>{title}</h2>
      <p>{note}</p>
      <ul>
        {features.map((f) => (
          <li key={f.key} className={styles.item}>
            <strong>{f.label}</strong>{' '}
            <Badge tone={f.enabled ? 'success' : 'neutral'}>
              {f.enabled ? 'включено' : 'выключено'}
            </Badge>{' '}
            {f.status !== 'available' && <Badge tone="neutral">{STATUS[f.status]}</Badge>}
            <div>{f.description}</div>
            {!f.section && (
              <div>
                Ответственный: {f.owner}. По умолчанию:{' '}
                {f.defaultEnabled ? 'включено' : 'выключено'}.
              </div>
            )}
            {f.dependsOn.length > 0 && (
              <div>
                Зависит от:{' '}
                {f.dependsOn.map((d) => features.find((x) => x.key === d)?.label ?? d).join(', ')}.
              </div>
            )}
            {f.blockedBy && <div>{f.blockedBy}</div>}
            {f.status === 'available' && (
              <Button size="sm" variant="secondary" onClick={() => void onToggle(f)}>
                {f.enabled ? 'Выключить' : 'Включить'}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
