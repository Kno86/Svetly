/** Primary sections from the approved site map. Items with `available: false` render disabled («скоро»). */
export interface NavItem {
  label: string;
  href: string;
  available: boolean;
}

export const primaryNav: NavItem[] = [
  { label: 'Новости', href: '/news', available: true },
  { label: 'Объявления', href: '/announcements', available: true },
  { label: 'Услуги', href: '/services', available: true },
  { label: 'Организации', href: '/organizations', available: true },
  { label: 'События', href: '/events', available: true },
  { label: 'Справочник', href: '/directory', available: true },
];
