/** Admin platform configuration shared by the /admin pages. The UI only hides what the API would refuse anyway. */

export interface AdminNavItem {
  href: string;
  label: string;
  /** `null` = visible to every staff member. */
  permission: string | null;
  group?: AdminNavGroup;
}

export type AdminNavGroup = 'Модерация' | 'Жители' | 'Контент' | 'Платформа';

export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin', label: 'Обзор', permission: null },
  {
    href: '/admin/moderation',
    label: 'Очередь модерации',
    permission: 'moderation.announcements',
    group: 'Модерация',
  },
  {
    href: '/admin/moderation/announcements',
    label: 'Объявления',
    permission: 'moderation.announcements',
    group: 'Модерация',
  },
  {
    href: '/admin/complaints',
    label: 'Жалобы',
    permission: 'complaints.manage',
    group: 'Модерация',
  },
  {
    href: '/admin/community',
    label: 'Вакансии и находки',
    permission: 'moderation.community',
    group: 'Модерация',
  },
  {
    href: '/admin/social',
    label: 'Лента и группы',
    permission: 'moderation.community',
    group: 'Модерация',
  },
  { href: '/admin/issues', label: 'Обращения', permission: 'issues.manage', group: 'Жители' },
  {
    href: '/admin/business',
    label: 'Заявки бизнеса',
    permission: 'business.review',
    group: 'Модерация',
  },
  { href: '/admin/polls', label: 'Опросы', permission: 'polls.manage', group: 'Жители' },
  {
    href: '/admin/content/news',
    label: 'Новости',
    permission: 'content.news.manage',
    group: 'Контент',
  },
  {
    href: '/admin/content/events',
    label: 'События',
    permission: 'content.events.manage',
    group: 'Контент',
  },
  {
    href: '/admin/content/organizations',
    label: 'Организации и услуги',
    permission: 'content.organizations.manage',
    group: 'Контент',
  },
  {
    href: '/admin/content/directory',
    label: 'Справочник',
    permission: 'content.directory.manage',
    group: 'Контент',
  },
  {
    href: '/admin/categories',
    label: 'Категории',
    permission: 'content.categories.manage',
    group: 'Контент',
  },
  { href: '/admin/users', label: 'Пользователи', permission: 'users.read', group: 'Платформа' },
  {
    href: '/admin/analytics',
    label: 'Аналитика',
    permission: 'analytics.read',
    group: 'Платформа',
  },
  { href: '/admin/audit', label: 'Журнал аудита', permission: 'audit.read', group: 'Платформа' },
  {
    href: '/admin/settings',
    label: 'Настройки',
    permission: 'settings.manage',
    group: 'Платформа',
  },
  {
    href: '/admin/integrations',
    label: 'Интеграции и функции',
    permission: 'settings.manage',
    group: 'Платформа',
  },
];

/** Splits visible items into labelled groups, keeping ADMIN_NAV order; ungrouped items come first. */
export function groupNav(
  items: readonly AdminNavItem[],
): Array<{ group: AdminNavGroup | null; items: AdminNavItem[] }> {
  const out: Array<{ group: AdminNavGroup | null; items: AdminNavItem[] }> = [];
  for (const item of items) {
    const group = item.group ?? null;
    const last = out.find((g) => g.group === group);
    if (last) last.items.push(item);
    else out.push({ group, items: [item] });
  }
  return out;
}

export function navFor(permissions: readonly string[]): AdminNavItem[] {
  if (permissions.length === 0) return [];
  return ADMIN_NAV.filter((i) => i.permission === null || permissions.includes(i.permission));
}

export type FieldType =
  | 'text'
  | 'textarea'
  | 'url'
  | 'tel'
  | 'number'
  | 'datetime'
  | 'date'
  | 'checkbox'
  | 'select'
  | 'category';

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  hint?: string;
  options?: Array<{ value: string; label: string }>;
}

export interface ContentKind {
  label: string;
  /** Path under /api/staff/. */
  api: string;
  permission: string;
  titleField: string;
  /** Public URL prefix for published records. */
  publicPath: string;
  categoryModules: string[];
  statuses: Array<{ value: string; label: string }>;
  fields: FieldDef[];
}

const STATUS_BASE = [
  { value: 'draft', label: 'Черновик' },
  { value: 'published', label: 'Опубликовано' },
  { value: 'archived', label: 'В архиве' },
];
const source: FieldDef[] = [
  { name: 'sourceName', label: 'Источник', type: 'text', hint: 'Откуда получены данные' },
  { name: 'sourceUrl', label: 'Ссылка на источник', type: 'url' },
];

export const CONTENT_KINDS: Record<string, ContentKind> = {
  news: {
    label: 'Новости',
    api: 'news',
    permission: 'content.news.manage',
    titleField: 'title',
    publicPath: '/news',
    categoryModules: ['news'],
    statuses: STATUS_BASE,
    fields: [
      { name: 'title', label: 'Заголовок', type: 'text', required: true },
      { name: 'excerpt', label: 'Анонс', type: 'textarea', hint: 'До 500 символов' },
      {
        name: 'body',
        label: 'Текст',
        type: 'textarea',
        required: true,
        hint: 'Абзацы разделяйте пустой строкой',
      },
      { name: 'categoryId', label: 'Категория', type: 'category' },
      { name: 'pinned', label: 'Закрепить вверху ленты', type: 'checkbox' },
      ...source,
    ],
  },
  events: {
    label: 'События',
    api: 'events',
    permission: 'content.events.manage',
    titleField: 'title',
    publicPath: '/events',
    categoryModules: ['events'],
    statuses: [
      ...STATUS_BASE.slice(0, 2),
      { value: 'cancelled', label: 'Отменено' },
      STATUS_BASE[2]!,
    ],
    fields: [
      { name: 'title', label: 'Название', type: 'text', required: true },
      { name: 'description', label: 'Описание', type: 'textarea', required: true },
      { name: 'organizer', label: 'Организатор', type: 'text', required: true },
      { name: 'location', label: 'Место', type: 'text', required: true },
      {
        name: 'latitude',
        label: 'Широта',
        type: 'number',
        hint: 'Только проверенные координаты (например, с места). Заполняйте вместе с долготой.',
      },
      { name: 'longitude', label: 'Долгота', type: 'number' },
      { name: 'startsAt', label: 'Начало', type: 'datetime', required: true },
      { name: 'endsAt', label: 'Окончание', type: 'datetime' },
      {
        name: 'capacity',
        label: 'Количество мест',
        type: 'number',
        hint: 'Пусто — без записи на платформе',
      },
      { name: 'registrationUrl', label: 'Внешняя ссылка на регистрацию', type: 'url' },
      { name: 'categoryId', label: 'Категория', type: 'category' },
    ],
  },
  organizations: {
    label: 'Организации и услуги',
    api: 'organizations',
    permission: 'content.organizations.manage',
    titleField: 'name',
    publicPath: '/organizations',
    categoryModules: ['organizations', 'services'],
    statuses: STATUS_BASE,
    fields: [
      {
        name: 'kind',
        label: 'Тип',
        type: 'select',
        options: [
          { value: 'organization', label: 'Организация' },
          { value: 'service', label: 'Частная услуга' },
        ],
      },
      { name: 'name', label: 'Название', type: 'text', required: true },
      { name: 'description', label: 'Описание', type: 'textarea', required: true },
      { name: 'services', label: 'Услуги и цены', type: 'textarea' },
      { name: 'categoryId', label: 'Категория', type: 'category' },
      { name: 'phone', label: 'Телефон', type: 'tel' },
      { name: 'website', label: 'Сайт', type: 'url' },
      { name: 'address', label: 'Адрес', type: 'text' },
      {
        name: 'latitude',
        label: 'Широта',
        type: 'number',
        hint: 'Только проверенные координаты (например, с места). Заполняйте вместе с долготой.',
      },
      { name: 'longitude', label: 'Долгота', type: 'number' },
      { name: 'serviceArea', label: 'Территория обслуживания', type: 'text' },
      { name: 'hours', label: 'Часы работы', type: 'text' },
      { name: 'hoursCheckedAt', label: 'Часы работы проверены', type: 'date' },
      ...source,
      { name: 'checkedAt', label: 'Карточка проверена', type: 'date' },
    ],
  },
  directory: {
    label: 'Справочник',
    api: 'directory',
    permission: 'content.directory.manage',
    titleField: 'title',
    publicPath: '/directory',
    categoryModules: ['directory'],
    statuses: STATUS_BASE,
    fields: [
      { name: 'title', label: 'Название', type: 'text', required: true },
      {
        name: 'kind',
        label: 'Тип',
        type: 'select',
        options: [
          { value: 'contact', label: 'Контакт' },
          { value: 'emergency', label: 'Экстренная служба' },
          { value: 'instruction', label: 'Инструкция' },
          { value: 'link', label: 'Ссылка' },
          { value: 'document', label: 'Документ' },
        ],
      },
      { name: 'body', label: 'Описание', type: 'textarea' },
      { name: 'phone', label: 'Телефон', type: 'tel' },
      { name: 'url', label: 'Ссылка', type: 'url' },
      { name: 'categoryId', label: 'Категория', type: 'category' },
      ...source,
      { name: 'checkedAt', label: 'Данные проверены', type: 'date' },
      { name: 'position', label: 'Порядок', type: 'number' },
    ],
  },
};

export type FormValues = Record<string, string | boolean>;

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO → value for `<input type="datetime-local">` / `type="date"` in the browser's time zone. */
export function toInput(iso: string | null | undefined, type: 'datetime' | 'date'): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return type === 'date' ? date : `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toFormValues(kind: ContentKind, record?: Record<string, unknown>): FormValues {
  const values: FormValues = { status: String(record?.status ?? 'draft') };
  for (const f of kind.fields) {
    const v = record?.[f.name];
    if (f.type === 'checkbox') values[f.name] = v === true;
    else if (f.type === 'datetime' || f.type === 'date')
      values[f.name] = toInput(v as string | null, f.type);
    else if (f.type === 'select') values[f.name] = String(v ?? f.options?.[0]?.value ?? '');
    else values[f.name] = v === null || v === undefined ? '' : String(v);
  }
  return values;
}

/** Form values → API body: blanks become null (or are omitted so server defaults apply), dates become ISO. */
export function toContentPayload(kind: ContentKind, values: FormValues): Record<string, unknown> {
  const body: Record<string, unknown> = { status: values.status };
  for (const f of kind.fields) {
    const raw = values[f.name];
    if (f.type === 'checkbox') {
      body[f.name] = raw === true;
      continue;
    }
    const v = typeof raw === 'string' ? raw.trim() : '';
    if (f.type === 'number')
      body[f.name] = v === '' ? (f.name === 'position' ? 0 : null) : Number(v);
    else if (f.type === 'datetime' || f.type === 'date')
      body[f.name] = v === '' ? null : new Date(f.type === 'date' ? `${v}T12:00` : v).toISOString();
    else if (v === '')
      body[f.name] = f.required || ['excerpt', 'services', 'body'].includes(f.name) ? '' : null;
    else body[f.name] = v;
  }
  return body;
}

export const COMPLAINT_REASONS: Record<string, string> = {
  spam: 'Спам или реклама',
  fraud: 'Мошенничество',
  offensive: 'Оскорбительное содержание',
  wrong_info: 'Неверная или устаревшая информация',
  other: 'Другое',
};

export const COMPLAINT_TARGETS: Record<string, { label: string; path: string }> = {
  announcement: { label: 'Объявление', path: '/announcements' },
  news: { label: 'Новость', path: '/news' },
  event: { label: 'Событие', path: '/events' },
  organization: { label: 'Организация', path: '/organizations' },
  job: { label: 'Вакансия', path: '/jobs' },
  lost_found: { label: 'Потеряно и найдено', path: '/lost-found' },
  group: { label: 'Группа', path: '/groups' },
  post: { label: 'Пост', path: '/feed' },
  comment: { label: 'Комментарий', path: '/feed' },
  message: { label: 'Личное сообщение', path: '' },
};

export const EVENT_LABELS: Record<string, string> = {
  page_view: 'Просмотр страницы',
  contact_click: 'Клик по контакту',
  client_error: 'Ошибка в браузере',
  search: 'Поиск',
  registration: 'Регистрация',
  publication_submitted: 'Публикация отправлена',
  publication_moderated: 'Решение модератора',
  comment_created: 'Комментарий',
  conversation_started: 'Новая переписка',
  favorite_added: 'Добавлено в избранное',
  event_registration: 'Запись на событие',
  business_application: 'Заявка бизнеса на размещение',
  business_inquiry: 'Заявка жителя организации',
};
