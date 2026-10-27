'use client';

import { useState } from 'react';
import { Alert, EmptyState, Skeleton } from '../../../components/ui/Feedback';
import { Select } from '../../../components/ui/Field';
import { useApi } from '../../../components/admin/useApi';
import { EVENT_LABELS } from '../../../lib/admin';
import styles from '../../../components/admin/admin.module.css';

interface Summary {
  timezone: string;
  days: number;
  retentionDays: number;
  active: { dau: number; wau: number; mau: number };
  totals: Array<{ name: string; count: number }>;
  modules: Array<{ module: string; count: number }>;
  sources: Array<{ source: string; medium: string | null; count: number }>;
  searches: Array<{ query: string; count: number }>;
  zeroResults: Array<{ query: string; count: number }>;
}

function Table({ head, rows }: { head: [string, string]; rows: Array<[string, number]> }) {
  if (!rows.length) return <p className={styles.muted}>Данных за период нет.</p>;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left' }}>{head[0]}</th>
          <th style={{ textAlign: 'right' }}>{head[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td>{k}</td>
            <td style={{ textAlign: 'right' }}>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState('30');
  const { data, error } = useApi<Summary>(`/api/admin/analytics?days=${days}`);
  return (
    <>
      <div className={styles.head}>
        <h1>Аналитика</h1>
      </div>
      <p className={styles.muted}>
        Только агрегаты, без IP-адресов и браузерных данных. Клик по телефону или сайту — это клик,
        а не состоявшийся звонок или покупка. Группы меньше 2 событий скрыты. Формулы метрик — в
        docs/ANALYTICS.md.
      </p>
      <div className={styles.toolbar}>
        <Select label="Период" value={days} onChange={(e) => setDays(e.target.value)}>
          <option value="7">7 дней</option>
          <option value="30">30 дней</option>
          <option value="90">90 дней</option>
        </Select>
      </div>
      {error && <Alert tone="error" title={error} />}
      {!data && !error && <Skeleton height="10rem" />}
      {data && (
        <>
          <p className={styles.muted}>
            Часовой пояс: {data.timezone}. Хранение событий: {data.retentionDays} дн.
          </p>
          <h2>Активные зарегистрированные пользователи</h2>
          <Table
            head={['Метрика', 'Значение']}
            rows={[
              ['DAU (сегодня)', data.active.dau],
              ['WAU (7 дней)', data.active.wau],
              ['MAU (30 дней)', data.active.mau],
            ]}
          />
          {data.totals.length === 0 ? (
            <EmptyState
              title="Событий пока нет"
              description="Данные появятся, когда жители начнут пользоваться платформой."
            />
          ) : (
            <>
              <h2>События за период</h2>
              <Table
                head={['Событие', 'Количество']}
                rows={data.totals.map((t) => [EVENT_LABELS[t.name] ?? t.name, t.count])}
              />
            </>
          )}
          <h2>Разделы (просмотры страниц)</h2>
          <Table
            head={['Раздел', 'Просмотры']}
            rows={data.modules.map((m) => [m.module, m.count])}
          />
          <h2>Источники переходов</h2>
          <Table
            head={['Источник', 'Переходы']}
            rows={data.sources.map((s) => [
              s.medium ? `${s.source} / ${s.medium}` : s.source,
              s.count,
            ])}
          />
          <h2>Частые запросы</h2>
          <Table head={['Запрос', 'Раз']} rows={data.searches.map((s) => [s.query, s.count])} />
          <h2>Запросы без результатов</h2>
          <Table head={['Запрос', 'Раз']} rows={data.zeroResults.map((s) => [s.query, s.count])} />
        </>
      )}
    </>
  );
}
