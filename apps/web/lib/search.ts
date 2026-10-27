export type SearchType =
  | 'news'
  | 'announcements'
  | 'organizations'
  | 'services'
  | 'events'
  | 'directory'
  | 'jobs'
  | 'lost_found'
  | 'groups'
  | 'posts';

export interface SearchHit {
  type: SearchType;
  slug: string;
  title: string;
  snippet: string;
  date: string | null;
}

export const SEARCH_TYPES: Record<SearchType, { label: string; href: (slug: string) => string }> = {
  news: { label: 'Новость', href: (s) => `/news/${s}` },
  announcements: { label: 'Объявление', href: (s) => `/announcements/${s}` },
  organizations: { label: 'Организация', href: (s) => `/organizations/${s}` },
  services: { label: 'Услуга', href: (s) => `/services/${s}` },
  events: { label: 'Событие', href: (s) => `/events/${s}` },
  directory: { label: 'Справочник', href: (s) => `/directory#${s}` },
  jobs: { label: 'Вакансия', href: (s) => `/jobs/${s}` },
  lost_found: { label: 'Потеряно и найдено', href: (s) => `/lost-found/${s}` },
  groups: { label: 'Группа', href: (s) => `/groups/${s}` },
  posts: { label: 'Пост', href: (s) => `/feed/${s}` },
};

export const SEARCH_SORT: Record<string, string> = {
  relevance: 'По релевантности',
  date: 'Сначала новые',
};

export function isSearchType(value: string | undefined): value is SearchType {
  return Boolean(value && Object.hasOwn(SEARCH_TYPES, value));
}
