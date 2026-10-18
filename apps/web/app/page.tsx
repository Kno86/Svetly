import { Badge, Card } from '../components/ui/Feedback';
import { ButtonLink } from '../components/ui/Button';
import { primaryNav } from '../components/shell/navigation';
import { fetchApiStatus, type ApiStatus } from '../lib/api-status';
import { getWebBuildInfo } from '../lib/build-info';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

const sectionInfo: Record<string, string> = {
  '/news': 'Новости посёлка и района: события, объявления администрации, важное рядом.',
  '/ads': 'Частные объявления жителей: продать, купить, отдать, найти.',
  '/services': 'Местные мастера и услуги — от ремонта до репетиторов.',
  '/organizations': 'Магазины, школы, медицина и сервисы территории.',
  '/events': 'Праздники, встречи, секции и мероприятия.',
  '/directory': 'Полезные телефоны, адреса и экстренные службы.',
};

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
      <rect width="400" height="300" fill="#103C2F" />
      <circle cx="270" cy="96" r="44" fill="#E9BC66" />
      <circle cx="270" cy="96" r="76" fill="#E9BC66" opacity="0.12" />
      <path d="M0 196C70 160 150 150 220 166S340 182 400 150V300H0Z" fill="#245844" />
      <path d="M0 236C90 210 170 214 250 230S360 246 400 226V300H0Z" fill="#1B4A39" />
      <path d="M60 120L92 196H28ZM104 140L130 202H78Z" fill="#7D9D58" />
      <path d="M150 172L178 148L206 172V204H150Z" fill="#F7F6F0" />
      <rect x="171" y="182" width="14" height="22" fill="#103C2F" />
      <path
        d="M150 300C178 262 226 246 262 222C284 207 288 192 272 180C278 196 266 206 242 218C200 238 148 258 112 300Z"
        fill="#F7F6F0"
      />
    </svg>
  );
}

export default async function HomePage() {
  const build = getWebBuildInfo();
  const api = await fetchApiStatus(process.env.API_INTERNAL_URL ?? 'http://api:4000');

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
              <ButtonLink href="#sections" size="lg">
                Какие будут разделы
              </ButtonLink>
              <ButtonLink href="/design-system" variant="secondary" size="lg">
                Дизайн-система
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
            <p>Разделы откроются поэтапно, после утверждения каждой фазы разработки.</p>
          </div>
          <div className="grid">
            {primaryNav.map((item) => (
              <Card key={item.href}>
                <div className={styles.cardHead}>
                  <span className={styles.cardIcon} aria-hidden="true">
                    {item.label.charAt(0)}
                  </span>
                  <Badge>скоро</Badge>
                </div>
                <h3>{item.label}</h3>
                <p className={styles.cardText}>{sectionInfo[item.href]}</p>
              </Card>
            ))}
          </div>
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
