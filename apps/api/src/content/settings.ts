import type { PrismaService } from '../prisma/prisma.service.js';

interface SettingSpec {
  group: string;
  label: string;
  hint: string;
  min: number;
  max: number;
  default: number;
}

/** Numeric platform settings editable in the admin; values outside `min..max` fall back to `default`. */
export const SETTINGS = {
  'moderation.trustedThreshold': {
    group: 'Модерация',
    label: 'Порог доверия',
    hint: 'Сколько одобренных публикаций без отклонений нужно автору, чтобы публиковать без проверки. 0 — без премодерации.',
    min: 0,
    max: 50,
    default: 3,
  },
  'announcements.ttlDays': {
    group: 'Объявления',
    label: 'Срок показа, дней',
    hint: 'Через сколько дней новое объявление снимается с показа.',
    min: 7,
    max: 90,
    default: 30,
  },
  'announcements.maxPending': {
    group: 'Объявления',
    label: 'Лимит на проверке',
    hint: 'Сколько объявлений одного автора может одновременно ждать проверки.',
    min: 1,
    max: 50,
    default: 10,
  },
  'jobs.ttlDays': {
    group: 'Вакансии и находки',
    label: 'Срок вакансии, дней',
    hint: 'Если автор не выбрал срок сам.',
    min: 7,
    max: 60,
    default: 30,
  },
  'lostFound.ttlDays': {
    group: 'Вакансии и находки',
    label: 'Срок записи «Потеряно и найдено», дней',
    hint: 'Если автор не выбрал срок сам.',
    min: 7,
    max: 60,
    default: 60,
  },
  'community.maxPending': {
    group: 'Вакансии и находки',
    label: 'Лимит на проверке',
    hint: 'Сколько вакансий или находок одного автора может одновременно ждать проверки.',
    min: 1,
    max: 50,
    default: 10,
  },
  'social.maxPendingPosts': {
    group: 'Группы и лента',
    label: 'Лимит постов на проверке',
    hint: 'Сколько постов одного автора может одновременно ждать проверки.',
    min: 1,
    max: 50,
    default: 5,
  },
  'social.maxPendingGroups': {
    group: 'Группы и лента',
    label: 'Лимит новых групп на проверке',
    hint: 'Сколько групп один житель может создать до решения модератора.',
    min: 1,
    max: 20,
    default: 2,
  },
  'business.maxPendingApplications': {
    group: 'Бизнес',
    label: 'Лимит заявок на карточку',
    hint: 'Сколько заявок на карточку организации один пользователь может подать одновременно.',
    min: 1,
    max: 20,
    default: 3,
  },
  'reviews.maxPending': {
    group: 'Бизнес',
    label: 'Лимит отзывов на проверке',
    hint: 'Сколько отзывов одного автора может одновременно ждать проверки.',
    min: 1,
    max: 50,
    default: 5,
  },
  'analytics.retentionDays': {
    group: 'Аналитика',
    label: 'Хранить события, дней',
    hint: 'Обезличенные события старше этого срока удаляются.',
    min: 30,
    max: 730,
    default: 180,
  },
} as const satisfies Record<string, SettingSpec>;

export type SettingKey = keyof typeof SETTINGS;

export const isSettingKey = (key: string): key is SettingKey => Object.hasOwn(SETTINGS, key);

export function validSetting(key: SettingKey, value: unknown): number | undefined {
  const spec = SETTINGS[key];
  const v = Number(value);
  return Number.isInteger(v) && v >= spec.min && v <= spec.max ? v : undefined;
}

export async function setting(prisma: PrismaService, key: SettingKey): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return (row && validSetting(key, row.value)) ?? SETTINGS[key].default;
}

export async function allSettings(prisma: PrismaService) {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.keys(SETTINGS) } } });
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  return (Object.keys(SETTINGS) as SettingKey[]).map((key) => ({
    key,
    ...SETTINGS[key],
    value:
      (stored.has(key) ? validSetting(key, stored.get(key)) : undefined) ?? SETTINGS[key].default,
  }));
}
