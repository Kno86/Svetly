import type { AppConfig, SvetlyEnvironment } from '../config/env.js';

/** `available` — implemented and switchable; the others can never be enabled until the integration exists. */
export type FeatureStatus = 'available' | 'not_configured' | 'not_implemented';

interface FeatureSpec {
  label: string;
  owner: string;
  description: string;
  defaultEnabled: boolean;
  environments: readonly SvetlyEnvironment[];
  dependsOn: readonly string[];
  status: FeatureStatus;
  reason?: string;
}

const BOTH: readonly SvetlyEnvironment[] = ['local', 'production'];

/**
 * Central feature registry (ТЗ §19). Security controls (auth, RBAC, CSRF, rate limits, moderation)
 * are deliberately not flags. Dependencies must be declared before the flags that use them.
 */
export const FEATURES = {
  recommendations: {
    label: 'Рекомендации',
    owner: 'Продукт',
    description: 'Подборка в кабинете по выбранным интересам, свежести и ближайшим событиям.',
    defaultEnabled: true,
    environments: BOTH,
    dependsOn: [],
    status: 'available',
  },
  groups: {
    label: 'Группы и лента',
    owner: 'Сообщество',
    description: 'Группы жителей, лента постов, комментарии и отметки «Нравится».',
    defaultEnabled: true,
    environments: BOTH,
    dependsOn: [],
    status: 'available',
  },
  chats: {
    label: 'Личные сообщения',
    owner: 'Сообщество',
    description: 'Переписка один на один, блокировка собеседника, жалобы на сообщения.',
    defaultEnabled: true,
    environments: BOTH,
    dependsOn: [],
    status: 'available',
  },
  ai_assistant: {
    label: 'AI-помощник',
    owner: 'Владелец платформы',
    description: 'Ответы по опубликованным данным SVETLY со ссылками на источники.',
    defaultEnabled: false,
    environments: BOTH,
    dependsOn: [],
    status: 'not_configured',
    reason: 'Провайдер AI, политика передачи данных, квоты и бюджет не согласованы.',
  },
  payments: {
    label: 'Платежи',
    owner: 'Владелец платформы',
    description: 'Приём оплаты через внешний платёжный сервис с серверным подтверждением.',
    defaultEnabled: false,
    environments: BOTH,
    dependsOn: [],
    status: 'not_configured',
    reason: 'Платёжный провайдер не выбран. Реальные платежи требуют согласования.',
  },
  marketplace: {
    label: 'Сделки marketplace',
    owner: 'Продукт',
    description: 'Оформление сделок между жителями. Доска объявлений работает без этого флага.',
    defaultEnabled: false,
    environments: BOTH,
    dependsOn: ['payments'],
    status: 'not_implemented',
    reason: 'Сделки внутри платформы не реализованы и требуют отдельного решения владельца.',
  },
  business_premium: {
    label: 'Платные возможности бизнеса',
    owner: 'Владелец платформы',
    description: 'Подписки, продвижение карточек и расширенная аналитика для бизнеса.',
    defaultEnabled: false,
    environments: BOTH,
    dependsOn: ['payments'],
    status: 'not_implemented',
    reason: 'Тарифы не утверждены, спрос не подтверждён.',
  },
  advertising: {
    label: 'Рекламные места',
    owner: 'Владелец платформы',
    description: 'Размеченные рекламные блоки.',
    defaultEnabled: false,
    environments: BOTH,
    dependsOn: [],
    status: 'not_implemented',
    reason: 'Рекламная политика и места размещения не согласованы.',
  },
  push_notifications: {
    label: 'Push-уведомления',
    owner: 'Продукт',
    description: 'Web Push для уведомлений кабинета.',
    defaultEnabled: false,
    environments: BOTH,
    dependsOn: [],
    status: 'not_configured',
    reason: 'Ключи Web Push (VAPID) и HTTPS-домен не настроены.',
  },
  multi_territory: {
    label: 'Несколько территорий',
    owner: 'Владелец платформы',
    description: 'Разделение контента и доступа по территориям.',
    defaultEnabled: false,
    environments: BOTH,
    dependsOn: [],
    status: 'not_implemented',
    reason: 'Запланировано на PHASE 12.',
  },
  mobile_features: {
    label: 'Мобильные приложения',
    owner: 'Владелец платформы',
    description: 'Сборки для Android/iOS. Сейчас доступна только PWA.',
    defaultEnabled: false,
    environments: BOTH,
    dependsOn: [],
    status: 'not_implemented',
    reason: 'Требует отдельного решения и проверки экономической целесообразности.',
  },
} as const satisfies Record<string, FeatureSpec>;

export type FeatureKey = keyof typeof FEATURES;
export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[];
export const FEATURES_SETTING = 'features.overrides';

export interface ResolvedFeature extends FeatureSpec {
  key: FeatureKey;
  enabled: boolean;
  /** Present when the flag is off for a reason other than the admin's choice. */
  blockedBy?: string;
}

export function isFeatureKey(key: string): key is FeatureKey {
  return Object.hasOwn(FEATURES, key);
}

export function resolveFeatures(
  overrides: unknown,
  environment: SvetlyEnvironment,
): ResolvedFeature[] {
  const chosen = (overrides && typeof overrides === 'object' ? overrides : {}) as Record<
    string,
    unknown
  >;
  const enabled = new Map<string, boolean>();
  return FEATURE_KEYS.map((key) => {
    const spec: FeatureSpec = FEATURES[key];
    let blockedBy: string | undefined;
    if (spec.status !== 'available') blockedBy = spec.reason;
    else if (!spec.environments.includes(environment))
      blockedBy = `Недоступно в среде ${environment}`;
    else {
      const missing = spec.dependsOn.find((d) => !enabled.get(d));
      if (missing) blockedBy = `Требует включённого флага ${missing}`;
    }
    const choice =
      typeof chosen[key] === 'boolean' ? (chosen[key] as boolean) : spec.defaultEnabled;
    const on = !blockedBy && choice;
    enabled.set(key, on);
    return { key, ...spec, enabled: on, ...(blockedBy ? { blockedBy } : {}) };
  });
}

export type ProviderStatus = 'configured' | 'not_configured';

/** External integrations and their honest state; nothing here pretends to work without credentials. */
export function providerStatuses(config: Pick<AppConfig, 'smtpUrl'>) {
  return [
    {
      key: 'email',
      label: 'Почта (SMTP)',
      status: (config.smtpUrl ? 'configured' : 'not_configured') as ProviderStatus,
      note: config.smtpUrl
        ? 'Письма отправляются через SMTP_URL.'
        : 'SMTP_URL не задан: письма не отправляются, пользователю показывается статус.',
    },
    {
      key: 'ai',
      label: 'AI-провайдер',
      status: 'not_configured' as ProviderStatus,
      note: FEATURES.ai_assistant.reason,
    },
    {
      key: 'payments',
      label: 'Платёжный сервис',
      status: 'not_configured' as ProviderStatus,
      note: FEATURES.payments.reason,
    },
    {
      key: 'maps',
      label: 'Интерактивная карта',
      status: 'not_configured' as ProviderStatus,
      note: 'Провайдер карт не выбран; /map показывает список.',
    },
    {
      key: 'push',
      label: 'Web Push',
      status: 'not_configured' as ProviderStatus,
      note: FEATURES.push_notifications.reason,
    },
    {
      key: 'social_login',
      label: 'Вход через VK / Telegram',
      status: 'not_configured' as ProviderStatus,
      note: 'Приложения VK ID и Telegram Login не зарегистрированы.',
    },
    {
      key: 'monitoring',
      label: 'Внешний мониторинг',
      status: 'not_configured' as ProviderStatus,
      note: 'Сервис мониторинга не выбран; есть /api/health/live и /api/health/ready.',
    },
  ];
}
