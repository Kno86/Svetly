import Link from 'next/link';
import { Badge, Card, EmptyState } from '../components/ui/Feedback';
import { ButtonLink } from '../components/ui/Button';
import { DemoBadge } from '../components/content/Blocks';
import { VerificationBadge } from '../components/content/OrganizationList';
import { Icon, type IconName } from '../components/ui/Icon';
import { fetchApiStatus, type ApiStatus } from '../lib/api-status';
import { getWebBuildInfo } from '../lib/build-info';
import { apiGet, formatDate, formatPrice } from '../lib/content';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

interface Category {
  slug: string;
  name: string;
}

interface HomeFeed {
  news: Array<{
    slug: string;
    title: string;
    excerpt: string | null;
    publishedAt: string;
    isDemo: boolean;
    category: Category | null;
  }>;
  announcements: Array<{
    slug: string;
    title: string;
    price: number | null;
    area: string | null;
    publishedAt: string;
    isDemo: boolean;
    category: Category | null;
  }>;
  organizations: Array<{
    slug: string;
    kind: string;
    name: string;
    serviceArea: string | null;
    address: string | null;
    verification: 'unverified' | 'verified';
    isDemo: boolean;
    category: Category | null;
  }>;
  events: Array<{
    slug: string;
    title: string;
    location: string | null;
    startsAt: string;
    isDemo: boolean;
  }>;
}

const quickActions: Array<{ href: string; icon: IconName; title: string; text: string }> = [
  { href: '/announcements/new', icon: 'plus', title: 'Подать объявление', text: 'Бесплатно' },
  { href: '/catalog', icon: 'grid', title: 'Найти мастера', text: 'Услуги и организации' },
  { href: '/issues/new', icon: 'bell', title: 'Сообщить о проблеме', text: 'Статус — в кабинете' },
  { href: '/events', icon: 'home', title: 'Афиша', text: 'События рядом' },
];

const communityLinks = [
  { href: '/polls', title: 'Опросы', text: 'Голосования жителей по вопросам посёлка.' },
  { href: '/issues', title: 'Обращения жителей', text: 'Проблемы и их статус — открыто для всех.' },
  { href: '/groups', title: 'Группы', text: 'Сообщества по интересам и домам.' },
];

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

function SectionHead({
  id,
  kicker,
  title,
  href,
  more,
}: {
  id: string;
  kicker: string;
  title: string;
  href: string;
  more: string;
}) {
  return (
    <div className={styles.sectionHead}>
      <div>
        <span className={styles.kicker}>{kicker}</span>
        <h2 id={id}>{title}</h2>
      </div>
      <Link href={href} className={styles.more}>
        {more} <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

export default async function HomePage() {
  const build = getWebBuildInfo();
  const [api, home] = await Promise.all([
    fetchApiStatus(process.env.API_INTERNAL_URL ?? 'http://api:4000'),
    apiGet<HomeFeed>('/api/home'),
  ]);
  const feed = home.ok ? home.data : undefined;
  const failed = (
    <p className={styles.muted}>Не удалось загрузить публикации. Обновите страницу через минуту.</p>
  );
  const [lead, ...moreNews] = feed?.news ?? [];

  return (
    <main id="main">
      <section className={styles.hero}>
        <div className={`container ${styles.heroInner}`}>
          <div>
            <span className={styles.kicker}>Посёлок Октябрьский и жилой район Светлый</span>
            <h1>
              Жизнь посёлка — <em className={styles.accent}>в одном месте</em>
            </h1>
            <p className={styles.lead}>
              Новости, объявления соседей, местные мастера и организации, события и обращения
              жителей.
            </p>
            <form method="get" action="/search" role="search" className={styles.search}>
              <label htmlFor="home-q" className="visually-hidden">
                Поиск по платформе
              </label>
              <input
                id="home-q"
                name="q"
                type="search"
                minLength={2}
                required
                placeholder="Найти новость, объявление, мастера…"
              />
              <button type="submit">
                <Icon name="search" size={20} />
                <span>Найти</span>
              </button>
            </form>
            <p className={styles.note}>
              <Badge tone="accent">Платформа в разработке</Badge> Записи публикуют жители и
              редакция, выдуманных данных нет.
            </p>
          </div>
          <aside className={styles.today} aria-labelledby="soon-heading">
            <h2 id="soon-heading">Ближайшие события</h2>
            {!feed ? (
              failed
            ) : feed.events.length === 0 ? (
              <p className={styles.muted}>
                Событий пока нет. Редакция публикует их после проверки.{' '}
                <Link href="/events">Афиша</Link>
              </p>
            ) : (
              <ol className={styles.timeline}>
                {feed.events.map((e) => (
                  <li key={e.slug}>
                    <time dateTime={e.startsAt}>{formatDate(e.startsAt, true)}</time>
                    <div>
                      <Link href={`/events/${e.slug}`}>{e.title}</Link>
                      {e.location && <p>{e.location}</p>}
                      <DemoBadge show={e.isDemo} />
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <div className={styles.sunline} aria-hidden="true" />
          </aside>
        </div>
      </section>

      <div className="container">
        <nav className={styles.actions} aria-label="Быстрые действия">
          {quickActions.map((a) => (
            <Link key={a.href} href={a.href} className={styles.action}>
              <span className={styles.actionIcon}>
                <Icon name={a.icon} />
              </span>
              <span>
                <b>{a.title}</b>
                <span>{a.text}</span>
              </span>
            </Link>
          ))}
        </nav>
      </div>

      <section className={styles.section} aria-labelledby="news-heading">
        <div className="container">
          <SectionHead
            id="news-heading"
            kicker="Редакция SVETLY"
            title="Новости"
            href="/news"
            more="Все новости"
          />
          {!feed ? (
            failed
          ) : !lead ? (
            <EmptyState
              title="Новостей пока нет"
              description="Редакция готовит первые материалы."
            />
          ) : (
            <div className={styles.news}>
              <article className={styles.leadStory}>
                <div className={styles.meta}>
                  {lead.category && <Badge tone="info">{lead.category.name}</Badge>}
                  <time dateTime={lead.publishedAt}>{formatDate(lead.publishedAt)}</time>
                  <DemoBadge show={lead.isDemo} />
                </div>
                <h3>
                  <Link href={`/news/${lead.slug}`}>{lead.title}</Link>
                </h3>
                {lead.excerpt && <p className={styles.muted}>{lead.excerpt}</p>}
              </article>
              {moreNews.length > 0 && (
                <ul className={styles.newsList} role="list">
                  {moreNews.map((n) => (
                    <li key={n.slug}>
                      <div className={styles.meta}>
                        {n.category && <span>{n.category.name}</span>}
                        <time dateTime={n.publishedAt}>{formatDate(n.publishedAt)}</time>
                        <DemoBadge show={n.isDemo} />
                      </div>
                      <Link href={`/news/${n.slug}`}>{n.title}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="ads-heading">
        <div className="container">
          <SectionHead
            id="ads-heading"
            kicker="От соседей"
            title="Объявления"
            href="/announcements"
            more="Все объявления"
          />
          {!feed ? (
            failed
          ) : feed.announcements.length === 0 ? (
            <EmptyState
              title="Объявлений пока нет"
              description="Станьте первым — это бесплатно."
              action={<ButtonLink href="/announcements/new">Подать объявление</ButtonLink>}
            />
          ) : (
            <div className="grid">
              {feed.announcements.map((a) => (
                <Card key={a.slug} interactive>
                  <div className={styles.meta}>
                    {a.category && <span>{a.category.name}</span>}
                    <DemoBadge show={a.isDemo} />
                  </div>
                  <h3 className={styles.cardTitle}>
                    <Link href={`/announcements/${a.slug}`}>{a.title}</Link>
                  </h3>
                  <p className={styles.price}>{formatPrice(a.price)}</p>
                  <p className={styles.muted}>
                    {[a.area, formatDate(a.publishedAt)].filter(Boolean).join(' · ')}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="biz-heading">
        <div className={`container ${styles.split}`}>
          <div>
            <span className={styles.kicker}>Местный бизнес</span>
            <h2 id="biz-heading">Услуги и организации</h2>
            <p className={styles.muted}>
              Каталог мастеров, магазинов и учреждений. Карточки добавляют владельцы, проверку
              проводит администратор.
            </p>
            <div className={styles.links}>
              <Link href="/organizations">Организации</Link>
              <Link href="/services">Услуги</Link>
              <Link href="/directory">Справочник</Link>
              <Link href="/map">Места</Link>
            </div>
          </div>
          <Card>
            {!feed ? (
              failed
            ) : feed.organizations.length === 0 ? (
              <EmptyState
                title="Каталог пока пуст"
                description="Владельцы могут добавить организацию бесплатно."
              />
            ) : (
              <ul className={styles.rows} role="list">
                {feed.organizations.map((o) => (
                  <li key={o.slug}>
                    <span className={styles.avatar} aria-hidden="true">
                      {o.name.charAt(0)}
                    </span>
                    <div>
                      <Link href={`/organizations/${o.slug}`}>{o.name}</Link>
                      <div className={styles.meta}>
                        {o.category && <span>{o.category.name}</span>}
                        <VerificationBadge value={o.verification} />
                        <DemoBadge show={o.isDemo} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="community-heading">
        <div className="container">
          <SectionHead
            id="community-heading"
            kicker="Сообщество"
            title="Соседи и обсуждения"
            href="/community"
            more="Весь раздел"
          />
          <div className="grid">
            {communityLinks.map((c) => (
              <Card key={c.href} interactive>
                <h3 className={styles.cardTitle}>
                  <Link href={c.href}>{c.title}</Link>
                </h3>
                <p className={styles.muted}>{c.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <div className="container">
        <section className={styles.band} aria-labelledby="owners-heading">
          <div>
            <span className={styles.kicker}>Предпринимателям</span>
            <h2 id="owners-heading">Расскажите о своём деле соседям</h2>
            <p>
              Бесплатная карточка организации или услуги. Заявки от жителей приходят в кабинет
              бизнеса.
            </p>
          </div>
          <ButtonLink href="/business" size="lg">
            Кабинет бизнеса
          </ButtonLink>
        </section>
      </div>

      <section className={styles.section} aria-labelledby="status-heading">
        <div className="container">
          <details className={styles.statusBox}>
            <summary id="status-heading">Состояние платформы</summary>
            <dl className={styles.status}>
              <dt>Web</dt>
              <dd data-testid="web-version">
                версия {build.version}, коммит {build.commit}, сборка {build.builtAt}
              </dd>
              <dt>API</dt>
              <dd data-testid="api-status">{describeApi(api)}</dd>
            </dl>
          </details>
        </div>
      </section>
    </main>
  );
}
