import Link from 'next/link';
import { Badge, Card } from '../components/ui/Feedback';
import { ButtonLink } from '../components/ui/Button';
import { primaryNav } from '../components/shell/navigation';
import { fetchApiStatus, type ApiStatus } from '../lib/api-status';
import { getWebBuildInfo } from '../lib/build-info';
import { apiGet, formatDate, formatPrice } from '../lib/content';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

const sectionInfo: Record<string, string> = {
  '/news': 'Новости посёлка и района: события, объявления администрации, важное рядом.',
  '/announcements': 'Частные объявления жителей: продать, купить, отдать, найти.',
  '/services': 'Местные мастера и услуги — от ремонта до репетиторов.',
  '/organizations': 'Магазины, школы, медицина и сервисы территории.',
  '/events': 'Праздники, встречи, секции и мероприятия.',
  '/directory': 'Полезные телефоны, адреса и экстренные службы.',
};

interface HomeFeed {
  news: Array<{ slug: string; title: string; publishedAt: string }>;
  announcements: Array<{ slug: string; title: string; price: number | null }>;
  events: Array<{ slug: string; title: string; startsAt: string }>;
}

function describeApi(status: ApiStatus): string {
  switch (status.state) {
    case 'ready':
      return `готов (версия ${status.version}, сборка ${status.builtAt})`;
    case 'not-ready':
      return `не готов (HTTP ${status.httpStatus})`;
    case 'unreachable':
      return 'недоступен';
  }
}

function HeroArt() {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="300" fill="#2F5D7C" />
      <circle cx="270" cy="96" r="44" fill="#F2B441" />
      <circle cx="270" cy="96" r="76" fill="#F2B441" opacity="0.12" />
      <path d="M0 196C70 160 150 150 220 166S340 182 400 150V300H0Z" fill="#4E6E4B" />
      <path d="M0 236C90 210 170 214 250 230S360 246 400 226V300H0Z" fill="#3B5639" />
      <path d="M60 120L92 196H28ZM104 140L130 202H78Z" fill="#8FA88A" />
      <path d="M150 172L178 148L206 172V204H150Z" fill="#FAF6EF" />
      <rect x="171" y="182" width="14" height="22" fill="#2F5D7C" />
      <path
        d="M150 300C178 262 226 246 262 222C284 207 288 192 272 180C278 196 266 206 242 218C200 238 148 258 112 300Z"
        fill="#FAF6EF"
      />
    </svg>
  );
}

export default async function HomePage() {
  const build = getWebBuildInfo();
  const [api, home] = await Promise.all([
    fetchApiStatus(process.env.API_INTERNAL_URL ?? 'http://api:4000'),
    apiGet<HomeFeed>('/api/home'),
  ]);
  const feed = home.ok ? home.data : undefined;
  const latest = feed
    ? [
        ...feed.news.map((n) => ({
          key: `n-${n.slug}`,
          href: `/news/${n.slug}`,
          title: n.title,
          kind: 'Новость',
          meta: formatDate(n.publishedAt),
        })),
        ...feed.events.map((e) => ({
          key: `e-${e.slug}`,
          href: `/events/${e.slug}`,
          title: e.title,
          kind: 'Событие',
          meta: formatDate(e.startsAt, true),
        })),
        ...feed.announcements.map((a) => ({
          key: `a-${a.slug}`,
          href: `/announcements/${a.slug}`,
          title: a.title,
          kind: 'Объявление',
          meta: formatPrice(a.price),
        })),
      ]
    : [];

  return (
    <main id="main">
      <section className={styles.hero}>
        <div className={`container ${styles.heroInner}`}>
          <div>
            <div className={styles.eyebrow}>
              <Badge tone="accent">Платформа в разработке</Badge>
            </div>
            <h1>Всё о жизни Октябрьского и Светлого — в одном месте</h1>
            <p className={styles.lead}>
              SVETLY — локальная цифровая платформа для жителей и предпринимателей: новости,
              объявления, услуги, организации и события рядом с домом.
            </p>
            <div className={styles.actions}>
              <ButtonLink href="/announcements/new" size="lg">
                Подать объявление
              </ButtonLink>
              <ButtonLink href="/search" variant="secondary" size="lg">
                Поиск по платформе
              </ButtonLink>
            </div>
          </div>
          <div className={styles.heroArt}>
            <HeroArt />
          </div>
        </div>
      </section>

      <section id="sections" className={styles.section}>
        <div className="container">
          <div className={styles.sectionHead}>
            <h2>Разделы платформы</h2>
            <p>Записи публикуют жители и редакция. Мы не заполняем разделы выдуманными данными.</p>
          </div>
          <div className="grid">
            {primaryNav.map((item) => (
              <Card key={item.href} interactive={item.available}>
                <div className={styles.cardHead}>
                  <span className={styles.cardIcon} aria-hidden="true">
                    {item.label.charAt(0)}
                  </span>
                  {!item.available && <Badge>скоро</Badge>}
                </div>
                <h3>{item.available ? <Link href={item.href}>{item.label}</Link> : item.label}</h3>
                <p className={styles.cardText}>{sectionInfo[item.href]}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="latest-heading">
        <div className="container">
          <div className={styles.sectionHead}>
            <h2 id="latest-heading">Свежее</h2>
          </div>
          {!feed ? (
            <p>Не удалось загрузить свежие публикации. Обновите страницу через минуту.</p>
          ) : latest.length === 0 ? (
            <p>
              Пока публикаций нет.{' '}
              <Link href="/announcements/new">Разместите первое объявление</Link>.
            </p>
          ) : (
            <div className="grid">
              {latest.map((item) => (
                <Card key={item.key} interactive>
                  <Badge>{item.kind}</Badge>
                  <h3>
                    <Link href={item.href}>{item.title}</Link>
                  </h3>
                  <p className={styles.cardText}>{item.meta}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="status-heading">
        <div className="container">
          <Card>
            <h2 id="status-heading" style={{ fontSize: 'var(--font-size-lg)' }}>
              Состояние платформы
            </h2>
            <dl className={styles.status}>
              <dt>Web</dt>
              <dd data-testid="web-version">
                версия {build.version}, коммит {build.commit}, сборка {build.builtAt}
              </dd>
              <dt>API</dt>
              <dd data-testid="api-status">{describeApi(api)}</dd>
            </dl>
          </Card>
        </div>
      </section>
    </main>
  );
}
