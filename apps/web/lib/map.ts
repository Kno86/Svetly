export interface Place {
  type: 'organization' | 'service' | 'event';
  slug: string;
  title: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  verification: 'unverified' | 'verified' | null;
  category: { slug: string; name: string } | null;
  startsAt: string | null;
}

export const PLACE_TYPES = {
  organization: { label: 'Организации', path: '/organizations' },
  service: { label: 'Услуги', path: '/services' },
  event: { label: 'События', path: '/events' },
} as const;

/** External map link: exact point when coordinates are verified, otherwise a text search. */
export function mapLink(p: Pick<Place, 'location' | 'latitude' | 'longitude'>): string | null {
  if (p.latitude != null && p.longitude != null)
    return `https://yandex.ru/maps/?pt=${p.longitude},${p.latitude}&z=17&l=map`;
  if (!p.location) return null;
  return `https://yandex.ru/maps/?text=${encodeURIComponent(p.location)}`;
}
