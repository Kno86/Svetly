/** Site map of the redesign (docs/redesign/INFORMATION_ARCHITECTURE.md). */
export interface NavItem {
  label: string;
  href: string;
  available: boolean;
  /** Hidden when this feature flag is switched off (the API refuses the module too). */
  feature?: string;
}

export interface Section extends NavItem {
  /** Path prefixes that belong to the section (for the «текущий раздел» marker). */
  match: string[];
}

/** Five top-level sections shown in the header. */
export const primaryNav: Section[] = [
  { label: 'Новости', href: '/news', available: true, feature: 'news', match: ['/news'] },
  {
    label: 'Объявления',
    href: '/announcements',
    available: true,
    feature: 'announcements',
    match: ['/announcements', '/jobs', '/lost-found'],
  },
  {
    label: 'Услуги и бизнес',
    href: '/catalog',
    available: true,
    match: ['/catalog', '/services', '/organizations', '/directory', '/map'],
  },
  {
    label: 'Сообщество',
    href: '/community',
    available: true,
    match: ['/community', '/feed', '/groups', '/polls', '/issues', '/events'],
  },
];

/** Every public module; used by the drawer «Ещё», the footer and the hub pages. */
export const sectionLinks: NavItem[] = [
  { label: 'Новости', href: '/news', available: true, feature: 'news' },
  { label: 'Объявления', href: '/announcements', available: true, feature: 'announcements' },
  { label: 'Вакансии', href: '/jobs', available: true, feature: 'jobs' },
  { label: 'Потеряно и найдено', href: '/lost-found', available: true, feature: 'lost_found' },
  { label: 'Организации', href: '/organizations', available: true, feature: 'organizations' },
  { label: 'Услуги', href: '/services', available: true, feature: 'organizations' },
  { label: 'Справочник', href: '/directory', available: true, feature: 'directory' },
  { label: 'Места', href: '/map', available: true, feature: 'organizations' },
  { label: 'События', href: '/events', available: true, feature: 'events' },
  { label: 'Обращения жителей', href: '/issues', available: true, feature: 'issues' },
  { label: 'Опросы', href: '/polls', available: true, feature: 'polls' },
  { label: 'Лента', href: '/feed', available: true, feature: 'groups' },
  { label: 'Группы', href: '/groups', available: true, feature: 'groups' },
];

export const moreNav: NavItem[] = sectionLinks.filter(
  (i) => !primaryNav.some((s) => s.href === i.href),
);

export function isActive(section: Section, pathname: string): boolean {
  return section.match.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

const AUTH_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];

/** Accepts only same-site relative paths, so `?next=` cannot redirect to another site. */
export function safeNext(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return null;
  }
  const path = value.split(/[?#]/)[0] ?? '';
  return AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}/`)) ? null : value;
}

export function loginHref(returnTo: string | null | undefined): string {
  const next = safeNext(returnTo);
  return next && next !== '/' ? `/login?next=${encodeURIComponent(next)}` : '/login';
}

/** Second-level tabs inside the merged sections; the legacy module routes stay the tab URLs. */
export const sectionTabs: Record<string, NavItem[]> = {
  '/announcements': [
    { label: 'Объявления', href: '/announcements', available: true, feature: 'announcements' },
    { label: 'Вакансии', href: '/jobs', available: true, feature: 'jobs' },
    { label: 'Потеряно и найдено', href: '/lost-found', available: true, feature: 'lost_found' },
  ],
  '/catalog': [
    { label: 'Обзор', href: '/catalog', available: true },
    { label: 'Организации', href: '/organizations', available: true, feature: 'organizations' },
    { label: 'Услуги', href: '/services', available: true, feature: 'organizations' },
    { label: 'Справочник', href: '/directory', available: true, feature: 'directory' },
    { label: 'Места', href: '/map', available: true, feature: 'organizations' },
  ],
  '/community': [
    { label: 'Обзор', href: '/community', available: true },
    { label: 'Лента', href: '/feed', available: true, feature: 'groups' },
    { label: 'Группы', href: '/groups', available: true, feature: 'groups' },
    { label: 'События', href: '/events', available: true, feature: 'events' },
    { label: 'Опросы', href: '/polls', available: true, feature: 'polls' },
    { label: 'Обращения', href: '/issues', available: true, feature: 'issues' },
  ],
};

/** Tabs for a section list page; null on detail/form pages and outside merged sections. */
/** Resident cabinet: pages live under different URLs, the tab row ties them together. */
export const cabinetSection: Section = {
  label: 'Кабинет',
  href: '/account',
  available: true,
  match: ['/account', '/messages', '/notifications', '/favorites'],
};

export const cabinetTabs: NavItem[] = [
  { label: 'Обзор и профиль', href: '/account', available: true },
  { label: 'Мои объявления', href: '/account/announcements', available: true },
  { label: 'Обращения и заявки', href: '/account/community', available: true },
  { label: 'Сообщения', href: '/messages', available: true, feature: 'chats' },
  { label: 'Уведомления', href: '/notifications', available: true },
  { label: 'Избранное', href: '/favorites', available: true },
  { label: 'Рекомендации', href: '/account/recommendations', available: true },
  { label: 'Бизнес', href: '/business', available: true },
];

export function tabsFor(pathname: string): { section: Section; items: NavItem[] } | null {
  for (const section of primaryNav) {
    const items = sectionTabs[section.href];
    if (items?.some((i) => i.href === pathname)) return { section, items };
  }
  if (cabinetTabs.some((i) => i.href === pathname && i.href !== '/business')) {
    return { section: cabinetSection, items: cabinetTabs };
  }
  return null;
}
