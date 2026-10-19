/** Labels and pure helpers for PHASE 6 resident modules (jobs, lost & found, issues, polls, business cabinet). */
export type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'info';

export const ISSUE_CATEGORIES: Record<string, string> = {
  roads: 'Дороги и тротуары',
  lighting: 'Освещение',
  waste: 'Мусор и контейнеры',
  water: 'Вода и канализация',
  landscaping: 'Благоустройство',
  safety: 'Безопасность',
  other: 'Другое',
};

export const ISSUE_STATUS: Record<string, { label: string; tone: Tone }> = {
  received: { label: 'Принято', tone: 'info' },
  reviewing: { label: 'На проверке', tone: 'warning' },
  assigned: { label: 'Назначен ответственный', tone: 'warning' },
  in_progress: { label: 'В работе', tone: 'warning' },
  resolved: { label: 'Решено', tone: 'success' },
  closed: { label: 'Закрыто', tone: 'neutral' },
  rejected: { label: 'Отклонено', tone: 'error' },
};

export const ISSUE_PRIORITY: Record<string, string> = {
  low: 'Низкий',
  normal: 'Обычный',
  high: 'Высокий',
};

export const POST_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'На проверке', tone: 'warning' },
  published: { label: 'Опубликовано', tone: 'success' },
  rejected: { label: 'Отклонено', tone: 'error' },
  resolved: { label: 'Нашлось', tone: 'success' },
  closed: { label: 'Снято', tone: 'neutral' },
  archived: { label: 'В архиве', tone: 'neutral' },
};

export const ORG_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: 'Черновик', tone: 'neutral' },
  pending: { label: 'Заявка на проверке', tone: 'warning' },
  needs_info: { label: 'Нужны уточнения', tone: 'warning' },
  rejected: { label: 'Отклонено', tone: 'error' },
  published: { label: 'Опубликовано', tone: 'success' },
  archived: { label: 'В архиве', tone: 'neutral' },
};

export const LF_KIND: Record<string, string> = { lost: 'Потеряно', found: 'Найдено' };
export const LF_SUBJECT: Record<string, string> = { item: 'Вещи', animal: 'Животные' };

export const POLL_PHASE: Record<'upcoming' | 'open' | 'closed', { label: string; tone: Tone }> = {
  upcoming: { label: 'Скоро', tone: 'info' },
  open: { label: 'Идёт', tone: 'success' },
  closed: { label: 'Завершён', tone: 'neutral' },
};

export const POLL_MODE: Record<string, string> = {
  anonymous:
    'Анонимный: результаты показываются только суммарно, имена проголосовавших никто не видит. Аккаунт нужен, чтобы засчитать один ответ на человека.',
  identified:
    'Именной: организатор опроса видит, кто как ответил. Публично показываются только суммарные результаты.',
};

export type FieldValue = string | boolean | string[];
export type FormValues = Record<string, FieldValue>;

export type FieldSpec = {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
} & (
  | { kind: 'text' | 'tel' | 'date' | 'url' }
  | { kind: 'textarea'; rows?: number }
  | { kind: 'select'; options: Array<[string, string]> }
  | { kind: 'checkbox' }
  | { kind: 'images'; max?: number }
);

export function initialValues(fields: FieldSpec[], source?: Record<string, unknown>): FormValues {
  const out: FormValues = {};
  for (const f of fields) {
    const v = source?.[f.name];
    if (f.kind === 'checkbox') out[f.name] = v === true;
    else if (f.kind === 'images') out[f.name] = Array.isArray(v) ? v.map(String) : [];
    else if (f.kind === 'select')
      out[f.name] = typeof v === 'string' ? v : (f.options[0]?.[0] ?? '');
    else if (f.kind === 'date') out[f.name] = typeof v === 'string' ? v.slice(0, 10) : '';
    else out[f.name] = typeof v === 'string' ? v : '';
  }
  return out;
}

/** Trims text; optional empty fields become `null` so the API clears them instead of storing "". */
export function toPayload(fields: FieldSpec[], values: FormValues): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = values[f.name];
    if (f.kind === 'checkbox') out[f.name] = v === true;
    else if (f.kind === 'images') out[f.name] = Array.isArray(v) ? v : [];
    else {
      const s = typeof v === 'string' ? v.trim() : '';
      out[f.name] = s === '' && !f.required && f.kind !== 'textarea' ? null : s;
    }
  }
  return out;
}

export function percent(votes: number, total: number): number {
  return total > 0 ? Math.round((votes / total) * 100) : 0;
}

export function tel(phone: string): string {
  return `tel:${phone.replace(/[^+0-9]/g, '')}`;
}
