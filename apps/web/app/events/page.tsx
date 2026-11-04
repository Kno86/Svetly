import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '../../components/ui/Feedback';
import { buttonClass } from '../../components/ui/Button';
import {
  Empty,
  Filters,
  LoadError,
  PageHead,
  Pager,
  styles,
} from '../../components/content/Blocks';
import {
  apiGet,
  dateParts,
  formatDate,
  pageParam,
  param,
  query,
  type Category,
  type CategoryRef,
  type Paged,
} from '../../lib/content';
import {
  currentMonth,
  dayKey,
  eventsByDay,
  isMonth,
  monthGrid,
  monthLabel,
  shiftMonth,
  type CalendarEvent,
} from '../../lib/calendar';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'События',
  description: 'Праздники, встречи, секции и мероприятия.',
};

interface EventItem {
  id: string;
  slug: string;
  title: string;
  location: string;
  startsAt: string;
  status: 'published' | 'cancelled';
  isDemo: boolean;
  category: CategoryRef | null;
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const when = param(sp, 'when') === 'past' ? 'past' : 'upcoming';
  const q = param(sp, 'q');
  const category = param(sp, 'category');
  const page = pageParam(sp);
  if (param(sp, 'view') === 'calendar') {
    const month = param(sp, 'month');
    return <CalendarView month={isMonth(month) ? month : currentMonth()} category={category} />;
  }
  const [list, cats] = await Promise.all([
    apiGet<Paged<EventItem>>(`/api/events${query({ when, q, category, page })}`),
    apiGet<Category[]>('/api/categories?module=events'),
  ]);
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="События"
        description="Время указано по Новосибирску."
        crumbs={[{ label: 'События' }]}
      />
      <ViewTabs active={when} />
      <Filters
        action="/events"
        q={q}
        category={category}
        categories={cats.ok ? cats.data : []}
        hidden={when === 'past' ? { when } : undefined}
      />
      {!list.ok ? (
        <LoadError />
      ) : list.data.items.length === 0 ? (
        <Empty
          filtered={Boolean(q || category)}
          title={when === 'past' ? 'Прошедших событий нет' : 'Ближайших событий пока нет'}
          description="События публикует редакция по данным организаторов."
        />
      ) : (
        <>
          <ul className={styles.rows} role="list">
            {list.data.items.map((e) => {
              const d = dateParts(e.startsAt);
              return (
                <li key={e.id}>
                  <time
                    dateTime={e.startsAt}
                    className={`${styles.dateBox} ${when === 'past' ? styles.dateBoxPast : ''}`}
                  >
                    <b>{d.day}</b>
                    <span>{d.month}</span>
                  </time>
                  <div>
                    <div className={styles.meta}>
                      {e.status === 'cancelled' && <Badge tone="error">Отменено</Badge>}
                      {e.category && <Badge>{e.category.name}</Badge>}
                      {e.isDemo && <Badge tone="warning">демо</Badge>}
                    </div>
                    <h2>
                      <Link href={`/events/${e.slug}`} className={styles.storyLink}>
                        {e.title}
                      </Link>
                    </h2>
                    <div className={styles.meta}>
                      <span>{d.time}</span>
                      <span>{e.location}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pager
            path="/events"
            page={page}
            total={list.data.total}
            limit={list.data.limit}
            params={{ when: when === 'past' ? when : undefined, q, category }}
          />
        </>
      )}
    </main>
  );
}

type View = 'upcoming' | 'past' | 'calendar';
const VIEWS: Array<{ value: View; label: string; href: string }> = [
  { value: 'upcoming', label: 'Предстоящие', href: '/events' },
  { value: 'past', label: 'Прошедшие', href: '/events?when=past' },
  { value: 'calendar', label: 'Календарь', href: '/events?view=calendar' },
];
const WEEKDAYS = [
  ['Пн', 'понедельник'],
  ['Вт', 'вторник'],
  ['Ср', 'среда'],
  ['Чт', 'четверг'],
  ['Пт', 'пятница'],
  ['Сб', 'суббота'],
  ['Вс', 'воскресенье'],
] as const;

function ViewTabs({ active }: { active: View }) {
  return (
    <nav className={styles.tabs} aria-label="Период">
      {VIEWS.map((v) => (
        <Link
          key={v.value}
          href={v.href}
          className={buttonClass({
            variant: active === v.value ? 'primary' : 'secondary',
            size: 'sm',
          })}
          aria-current={active === v.value ? 'page' : undefined}
        >
          {v.label}
        </Link>
      ))}
    </nav>
  );
}

function CalendarEntry({ e }: { e: CalendarEvent }) {
  return (
    <>
      <Link
        href={`/events/${e.slug}`}
        className={e.status === 'cancelled' ? styles.calendarCancelled : undefined}
      >
        {dateParts(e.startsAt).time} {e.title}
      </Link>
      {e.status === 'cancelled' && <span className="visually-hidden"> (отменено)</span>}
    </>
  );
}

async function CalendarView({ month, category }: { month: string; category?: string }) {
  const [list, cats] = await Promise.all([
    apiGet<{ items: CalendarEvent[]; truncated: boolean }>(
      `/api/events/calendar${query({ month, category })}`,
    ),
    apiGet<Category[]>('/api/categories?module=events'),
  ]);
  const href = (m: string) => `/events${query({ view: 'calendar', month: m, category })}`;
  const today = dayKey(new Date());
  const byDay = list.ok ? eventsByDay(list.data.items, month) : new Map<string, CalendarEvent[]>();
  const label = monthLabel(month);
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="События"
        description="Время указано по Новосибирску."
        crumbs={[{ label: 'События', href: '/events' }, { label: 'Календарь' }]}
      />
      <ViewTabs active="calendar" />
      <Filters
        action="/events"
        category={category}
        categories={cats.ok ? cats.data : []}
        hidden={{ view: 'calendar', month }}
        noSearch
      />
      <div className={styles.calendarNav}>
        <Link
          href={href(shiftMonth(month, -1))}
          className={buttonClass({ variant: 'secondary', size: 'sm' })}
        >
          ← <span className="visually-hidden">Предыдущий месяц: </span>
          {monthLabel(shiftMonth(month, -1))}
        </Link>
        <h2 aria-live="polite">{label}</h2>
        <Link
          href={href(shiftMonth(month, 1))}
          className={buttonClass({ variant: 'secondary', size: 'sm' })}
        >
          <span className="visually-hidden">Следующий месяц: </span>
          {monthLabel(shiftMonth(month, 1))} →
        </Link>
      </div>
      {!list.ok ? (
        <LoadError />
      ) : (
        <>
          {list.data.truncated && (
            <p className={styles.meta}>Показаны первые 500 событий месяца.</p>
          )}
          <table className={styles.calendar}>
            <caption className="visually-hidden">{`События: ${label}`}</caption>
            <thead>
              <tr>
                {WEEKDAYS.map(([short, full]) => (
                  <th key={short} scope="col">
                    <abbr title={full}>{short}</abbr>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthGrid(month).map((week) => (
                <tr key={week[0]!.key}>
                  {week.map((d) => {
                    const events = d.inMonth ? (byDay.get(d.key) ?? []) : [];
                    return (
                      <td
                        key={d.key}
                        className={[
                          d.inMonth ? '' : styles.calendarOut,
                          d.key === today ? styles.calendarToday : '',
                        ].join(' ')}
                        aria-current={d.key === today ? 'date' : undefined}
                      >
                        <span className={styles.calendarDay}>{d.day}</span>
                        {events.length > 0 && (
                          <ul>
                            {events.map((e) => (
                              <li key={e.id}>
                                <CalendarEntry e={e} />
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {byDay.size === 0 ? (
            <Empty
              filtered={Boolean(category)}
              title="В этом месяце событий нет"
              description="События публикует редакция по данным организаторов."
            />
          ) : (
            <ul className={styles.agenda} role="list">
              {[...byDay.entries()].map(([key, events]) => (
                <li key={key}>
                  <h3>
                    <time dateTime={key}>{formatDate(`${key}T12:00:00+07:00`)}</time>
                  </h3>
                  <ul role="list">
                    {events.map((e) => (
                      <li key={e.id}>
                        <CalendarEntry e={e} />
                        {e.location && <span className={styles.meta}> · {e.location}</span>}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
