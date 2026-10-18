/**
 * Minimal same-origin client for the SVETLY auth API (`/api/auth/*` is served by Better Auth in the API).
 * Session cookies are httpOnly; this code never sees or stores them.
 */
export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  code?: string;
}

export async function apiRequest<T>(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      credentials: 'same-origin',
      headers: init.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    return { ok: false, status: 0, code: 'NETWORK_ERROR' };
  }
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  const code = data && typeof data === 'object' && 'code' in data ? String(data.code) : undefined;
  return { ok: res.ok, status: res.status, data: res.ok ? (data as T) : undefined, code };
}

const MESSAGES: Record<string, string> = {
  NETWORK_ERROR: 'Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.',
  INVALID_EMAIL_OR_PASSWORD: 'Неверный email или пароль.',
  EMAIL_NOT_VERIFIED: 'Email не подтверждён. Мы отправили письмо со ссылкой ещё раз.',
  USER_ALREADY_EXISTS: 'Не удалось зарегистрироваться с этим email.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Не удалось зарегистрироваться с этим email.',
  PASSWORD_TOO_SHORT: 'Пароль слишком короткий: нужно не меньше 10 символов.',
  PASSWORD_TOO_LONG: 'Пароль слишком длинный: не больше 128 символов.',
  INVALID_PASSWORD: 'Текущий пароль указан неверно.',
  INVALID_TOKEN: 'Ссылка недействительна или устарела. Запросите новую.',
  USER_BLOCKED: 'Учётная запись заблокирована. Обратитесь в поддержку.',
  EMAIL_NOT_CONFIGURED: 'Отправка писем пока не настроена. Обратитесь к администратору.',
  CSRF_ORIGIN_MISMATCH: 'Запрос отклонён из соображений безопасности. Обновите страницу.',
};

export function errorMessage(result: ApiResult<unknown>): string {
  const known = result.code ? MESSAGES[result.code] : undefined;
  if (known) return known;
  if (result.status === 429) return 'Слишком много попыток. Подождите немного и попробуйте снова.';
  return 'Что-то пошло не так. Попробуйте ещё раз.';
}

export const MIN_PASSWORD_LENGTH = 10;
