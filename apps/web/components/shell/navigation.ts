/** Primary sections from the approved site map. Items with `available: false` render disabled («скоро»). */
export interface NavItem {
  label: string;
  href: string;
  available: boolean;
  /** Hidden when this feature flag is switched off (the API refuses the module too). */
  feature?: string;
}

export const primaryNav: NavItem[] = [
  { label: 'Новости', href: '/news', available: true },
  { label: 'Объявления', href: '/announcements', available: true },
  { label: 'Услуги', href: '/services', available: true },
  { label: 'Организации', href: '/organizations', available: true },
  { label: 'События', href: '/events', available: true },
  { label: 'Справочник', href: '/directory', available: true },
  { label: 'Места', href: '/map', available: true },
  { label: 'Вакансии', href: '/jobs', available: true },
  { label: 'Находки', href: '/lost-found', available: true },
  { label: 'Обращения', href: '/issues', available: true },
  { label: 'Опросы', href: '/polls', available: true },
  { label: 'Лента', href: '/feed', available: true, feature: 'groups' },
  { label: 'Группы', href: '/groups', available: true, feature: 'groups' },
];
