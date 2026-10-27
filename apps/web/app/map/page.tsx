import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHead, styles } from '../../components/content/Blocks';
import { Alert, Badge, EmptyState } from '../../components/ui/Feedback';
import { apiGet, formatDate } from '../../lib/content';
import { PLACE_TYPES, mapLink, type Place } from '../../lib/map';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Места на карте',
  description: 'Организации, услуги и события с адресами.',
};

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const type = typeof sp.type === 'string' && sp.type in PLACE_TYPES ? sp.type : '';
  const res = await apiGet<{ places: Place[]; withCoordinates: number }>('/api/map');
  const places = res.ok ? res.data.places.filter((p) => !type || p.type === type) : [];
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Места"
        description="Интерактивная карта не подключена: провайдер карт ещё не выбран. Пока это список с адресами — ссылка откроет адрес в Яндекс Картах. Координаты показываются только проверенные редакцией."
        crumbs={[{ label: 'Главная', href: '/' }, { label: 'Места' }]}
      />
      <nav
        aria-label="Тип места"
        style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}
      >
        <Link href="/map" aria-current={!type ? 'page' : undefined}>
          Все
        </Link>
        {Object.entries(PLACE_TYPES).map(([k, v]) => (
          <Link key={k} href={`/map?type=${k}`} aria-current={type === k ? 'page' : undefined}>
            {v.label}
          </Link>
        ))}
      </nav>
      {!res.ok ? (
        <Alert tone="error" title="Не удалось загрузить список мест. Обновите страницу." />
      ) : !places.length ? (
        <EmptyState
          title="Мест с адресами пока нет"
          description="Они появятся, когда редакция опубликует организации, услуги или события с указанным адресом."
        />
      ) : (
        <ul style={{ display: 'grid', gap: 'var(--space-4)', padding: 0, listStyle: 'none' }}>
          {places.map((p) => {
            const link = mapLink(p);
            return (
              <li key={`${p.type}:${p.slug}`}>
                <Link href={`${PLACE_TYPES[p.type].path}/${p.slug}`}>
                  <strong>{p.title}</strong>
                </Link>{' '}
                <Badge>{PLACE_TYPES[p.type].label}</Badge>
                {p.verification === 'verified' && <Badge tone="success">Данные проверены</Badge>}
                <div>
                  {p.location ?? 'Адрес не указан'}
                  {p.startsAt && ` · ${formatDate(p.startsAt, true)}`}
                </div>
                {link && (
                  <a href={link} target="_blank" rel="noopener noreferrer">
                    {p.latitude != null ? 'Точка на Яндекс Картах' : 'Найти адрес на Яндекс Картах'}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
