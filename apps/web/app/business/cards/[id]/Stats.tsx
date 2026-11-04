'use client';

import { useState } from 'react';
import { styles } from '../../../../components/content/Blocks';
import { useApi } from '../../../../components/admin/useApi';
import { Button } from '../../../../components/ui/Button';
import { Alert, Skeleton } from '../../../../components/ui/Feedback';

interface Day {
  day: string;
  views: number;
  contactClicks: number;
  inquiries: number;
}
interface CardStats {
  days: number;
  published: boolean;
  totals: { views: number; contactClicks: number; inquiries: number };
  daily: Day[];
}

const PERIODS = [7, 30, 90] as const;
const dayLabel = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

export function Stats({ id }: { id: string }) {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const { data, error } = useApi<CardStats>(`/api/business/organizations/${id}/stats?days=${days}`);
  const tiles = data && [
    {
      label: 'Просмотры карточки',
      value: data.totals.views,
      note: 'Оценка, без отказавшихся от учёта',
    },
    {
      label: 'Переходы к контактам',
      value: data.totals.contactClicks,
      note: 'Клики по телефону, сайту, карте',
    },
    { label: 'Заявки жителей', value: data.totals.inquiries, note: 'Точное число' },
  ];
  const active = data?.daily.filter((d) => d.views || d.contactClicks || d.inquiries) ?? [];
  return (
    <section aria-labelledby="stats" className={styles.cabinetStats}>
      <h2 id="stats">Статистика</h2>
      <div className={styles.tabs} role="group" aria-label="Период">
        {PERIODS.map((p) => (
          <Button
            key={p}
            size="sm"
            variant={days === p ? 'primary' : 'secondary'}
            aria-pressed={days === p}
            onClick={() => setDays(p)}
          >
            {p} дней
          </Button>
        ))}
      </div>
      {error && <Alert tone="error" title="Не удалось загрузить статистику" />}
      {!data && !error && <Skeleton height="6rem" />}
      {data && tiles && (
        <>
          {!data.published && (
            <Alert tone="info" title="Карточка ещё не опубликована">
              Просмотры начнут считаться после публикации в каталоге.
            </Alert>
          )}
          <ul className={styles.tiles} role="list">
            {tiles.map((t) => (
              <li key={t.label}>
                <div className={styles.tile}>
                  <span>{t.label}</span>
                  <b>{t.value}</b>
                  <span className={styles.meta}>{t.note}</span>
                </div>
              </li>
            ))}
          </ul>
          {active.length === 0 ? (
            <p className={styles.meta}>За выбранный период событий нет.</p>
          ) : (
            <div className={styles.tableScroll}>
              <table>
                <caption className="visually-hidden">По дням, время новосибирское</caption>
                <thead>
                  <tr>
                    <th scope="col">День</th>
                    <th scope="col">Просмотры</th>
                    <th scope="col">Контакты</th>
                    <th scope="col">Заявки</th>
                  </tr>
                </thead>
                <tbody>
                  {active
                    .slice()
                    .reverse()
                    .map((d) => (
                      <tr key={d.day}>
                        <th scope="row">
                          <time dateTime={d.day}>
                            {dayLabel.format(new Date(`${d.day}T00:00:00Z`))}
                          </time>
                        </th>
                        <td>{d.views}</td>
                        <td>{d.contactClicks}</td>
                        <td>{d.inquiries}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
          <p className={styles.meta}>
            Просмотры и переходы считаются по обезличенным событиям браузера: посетители с Do Not
            Track или Global Privacy Control не учитываются, события хранятся ограниченный срок.
          </p>
        </>
      )}
    </section>
  );
}
