/**
 * Primary sections from the approved site map. Sections are not implemented yet (PHASE 3+),
 * so they render as disabled items marked «скоро» instead of linking to placeholder pages.
 */
export interface NavItem {
  label: string;
  href: string;
  available: boolean;
}

export const primaryNav: NavItem[] = [
  { label: 'Новости', href: '/news', available: false },
  { label: 'Объявления', href: '/ads', available: false },
  { label: 'Услуги', href: '/services', available: false },
  { label: 'Организации', href: '/organizations', available: false },
  { label: 'События', href: '/events', available: false },
  { label: 'Справочник', href: '/directory', available: false },
];
