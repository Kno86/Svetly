/**
 * Single source of truth for roles and permissions. The migration seeds exactly this data and the
 * `rbac-matrix` test fails if the database and this file drift apart.
 * Permissions for future modules are added in the phase that implements them.
 */
export const PERMISSIONS = {
  'users.read': 'Поиск пользователей и просмотр карточки (минимально необходимые данные)',
  'users.block': 'Блокировка и разблокировка пользователей (с отзывом всех сессий)',
  'users.sessions.revoke': 'Отзыв сессий другого пользователя',
  'roles.read': 'Просмотр ролей и назначений',
  'roles.assign': 'Назначение и снятие ролей ниже собственного уровня',
  'audit.read': 'Просмотр журнала аудита',
  'content.news.manage': 'Создание, редактирование и публикация новостей',
  'content.events.manage': 'Создание, редактирование и публикация событий',
  'content.organizations.manage': 'Управление карточками организаций и услуг',
  'content.directory.manage': 'Управление полезным справочником',
  'content.categories.manage': 'Управление категориями модулей',
  'moderation.announcements': 'Модерация объявлений жителей (одобрение, отклонение, снятие)',
  'complaints.manage': 'Рассмотрение жалоб на контент',
  'organizations.verify': 'Подтверждение проверки данных организаций',
  'settings.manage': 'Изменение настроек платформы (порог доверия модерации)',
  'analytics.read': 'Просмотр агрегированной аналитики',
  'moderation.community': 'Модерация вакансий и раздела «Потеряно и найдено»',
  'issues.manage': 'Работа с обращениями жителей: статусы, приоритет, ответственный, комментарии',
  'issues.respond': 'Публичный ответ платформы по обращению',
  'polls.manage': 'Создание и проведение опросов',
  'business.review': 'Рассмотрение заявок бизнеса и изменений карточек владельцами',
} as const;

const CONTENT: readonly PermissionCode[] = [
  'content.news.manage',
  'content.events.manage',
  'content.organizations.manage',
  'content.directory.manage',
];

export type PermissionCode = keyof typeof PERMISSIONS;

export interface RoleDefinition {
  name: string;
  description: string;
  /** Lower = more privileged. A grantor may only grant/revoke roles with a strictly greater rank. */
  rank: number;
  permissions: readonly PermissionCode[];
}

export const ROLES = {
  super_admin: {
    name: 'Супер-администратор',
    description: 'Полный доступ, управление администраторами. Создаётся только командой CLI.',
    rank: 10,
    permissions: [
      'users.read',
      'users.block',
      'users.sessions.revoke',
      'roles.read',
      'roles.assign',
      'audit.read',
      ...CONTENT,
      'content.categories.manage',
      'moderation.announcements',
      'complaints.manage',
      'organizations.verify',
      'settings.manage',
      'analytics.read',
      'moderation.community',
      'issues.manage',
      'issues.respond',
      'polls.manage',
      'business.review',
    ],
  },
  admin: {
    name: 'Администратор',
    description: 'Управление платформой и пользователями; не может выдавать роли администратора.',
    rank: 20,
    permissions: [
      'users.read',
      'users.block',
      'users.sessions.revoke',
      'roles.read',
      'roles.assign',
      'audit.read',
      ...CONTENT,
      'content.categories.manage',
      'moderation.announcements',
      'complaints.manage',
      'organizations.verify',
      'settings.manage',
      'analytics.read',
      'moderation.community',
      'issues.manage',
      'issues.respond',
      'polls.manage',
      'business.review',
    ],
  },
  moderator: {
    name: 'Модератор',
    description: 'Модерация объявлений, контента и жалоб.',
    rank: 40,
    permissions: [
      'users.read',
      'moderation.announcements',
      'complaints.manage',
      'moderation.community',
      'issues.manage',
    ],
  },
  editor: {
    name: 'Редактор',
    description: 'Новости, события, организации и справочник.',
    rank: 40,
    permissions: [...CONTENT, 'polls.manage'],
  },
  support: {
    name: 'Поддержка',
    description: 'Поиск пользователей и обработка обращений с минимально необходимыми данными.',
    rank: 40,
    permissions: ['users.read', 'complaints.manage', 'issues.manage'],
  },
} as const satisfies Record<string, RoleDefinition>;

export type RoleCode = keyof typeof ROLES;

/** Roles that can never be granted through the API. */
export const CLI_ONLY_ROLES: readonly RoleCode[] = ['super_admin'];

export function isRoleCode(value: string): value is RoleCode {
  return Object.hasOwn(ROLES, value);
}

export function permissionsForRoles(roles: readonly string[]): Set<PermissionCode> {
  const result = new Set<PermissionCode>();
  for (const role of roles) {
    if (isRoleCode(role)) ROLES[role].permissions.forEach((p) => result.add(p));
  }
  return result;
}

/** Best (lowest) rank among the given roles; ordinary users have no staff rank. */
export function bestRank(roles: readonly string[]): number {
  return Math.min(Infinity, ...roles.filter(isRoleCode).map((r) => ROLES[r].rank));
}

export function canManageRole(grantorRoles: readonly string[], target: RoleCode): boolean {
  if (CLI_ONLY_ROLES.includes(target)) return false;
  return bestRank(grantorRoles) < ROLES[target].rank;
}
