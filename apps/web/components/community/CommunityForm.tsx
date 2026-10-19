'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '../ui/Button';
import { Alert, Skeleton } from '../ui/Feedback';
import { Checkbox, Select, TextArea, TextField } from '../ui/Field';
import { apiRequest, errorMessage } from '../../lib/auth-client';
import { initialValues, toPayload, type FieldSpec, type FormValues } from '../../lib/community';
import { checkImage } from '../content/AnnouncementForm';
import styles from '../content/content.module.css';

const IMAGE_TYPES = 'image/jpeg,image/png,image/webp';

/**
 * Config-driven form for resident submissions (jobs, lost & found, issues, business cards).
 * Validation mirrors the API limits; the server remains the source of truth.
 */
export function CommunityForm({
  fields,
  endpoint,
  method = 'POST',
  loadFrom,
  redirectTo,
  submitLabel,
  loginReason,
  intro,
}: {
  fields: FieldSpec[];
  endpoint: string;
  method?: 'POST' | 'PATCH';
  loadFrom?: string;
  redirectTo: (data: Record<string, unknown>) => string;
  submitLabel: string;
  loginReason: string;
  intro?: ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'anonymous' | 'ready' | 'error'>('loading');
  const [values, setValues] = useState<FormValues>(() => initialValues(fields));
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const me = await apiRequest('/api/me');
      if (cancelled) return;
      if (me.status === 401) return setState('anonymous');
      if (!me.ok) return setState('error');
      if (loadFrom) {
        const existing = await apiRequest<Record<string, unknown>>(loadFrom);
        if (cancelled) return;
        if (!existing.ok || !existing.data) return setState('error');
        setValues(initialValues(fields, existing.data));
      }
      setState('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [fields, loadFrom]);

  const set = (name: string, value: FormValues[string]) =>
    setValues((v) => ({ ...v, [name]: value }));

  async function upload(name: string, max: number, files: FileList | null) {
    if (!files) return;
    setError(undefined);
    const current = (values[name] as string[]) ?? [];
    const added: string[] = [];
    setUploading(true);
    for (const file of [...files].slice(0, max - current.length)) {
      const problem = checkImage(file);
      if (problem) {
        setError(`${file.name}: ${problem}`);
        continue;
      }
      const r = await apiRequest<{ id: string }>('/api/media', { file });
      if (!r.ok || !r.data) setError(`${file.name}: ${errorMessage(r)}`);
      else added.push(r.data.id);
    }
    setUploading(false);
    setValues((v) => ({
      ...v,
      [name]: [...((v[name] as string[]) ?? []), ...added].slice(0, max),
    }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const r = await apiRequest<Record<string, unknown>>(endpoint, {
      method,
      body: toPayload(fields, values),
    });
    setBusy(false);
    if (!r.ok) return setError(errorMessage(r));
    router.push(redirectTo(r.data ?? {}));
  }

  if (state === 'loading') return <Skeleton height="20rem" />;
  if (state === 'anonymous')
    return (
      <Alert tone="info" title="Нужно войти">
        {loginReason} <Link href="/login">Войти</Link> или{' '}
        <Link href="/register">зарегистрироваться</Link>.
      </Alert>
    );
  if (state === 'error')
    return <Alert tone="error" title="Не удалось загрузить форму. Обновите страницу." />;

  return (
    <form className={styles.form} onSubmit={submit}>
      {intro}
      {error && <Alert tone="error" title={error} />}
      {fields.map((f) => {
        const common = {
          label: f.label,
          hint: f.hint,
          required: f.required,
          minLength: f.minLength,
          maxLength: f.maxLength,
        };
        switch (f.kind) {
          case 'textarea':
            return (
              <TextArea
                key={f.name}
                {...common}
                rows={f.rows ?? 5}
                value={values[f.name] as string}
                onChange={(e) => set(f.name, e.target.value)}
              />
            );
          case 'select':
            return (
              <Select
                key={f.name}
                label={f.label}
                hint={f.hint}
                required={f.required}
                value={values[f.name] as string}
                onChange={(e) => set(f.name, e.target.value)}
              >
                {f.options.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            );
          case 'checkbox':
            return (
              <div key={f.name}>
                <Checkbox
                  label={f.label}
                  checked={values[f.name] === true}
                  onChange={(e) => set(f.name, e.target.checked)}
                />
                {f.hint && <p className={styles.excerpt}>{f.hint}</p>}
              </div>
            );
          case 'images': {
            const max = f.max ?? 6;
            const ids = values[f.name] as string[];
            return (
              <div key={f.name}>
                <TextField
                  label={`${f.label} (${ids.length} из ${max})`}
                  hint={f.hint ?? 'JPEG, PNG или WebP до 5 МБ'}
                  type="file"
                  accept={IMAGE_TYPES}
                  multiple
                  disabled={uploading || ids.length >= max}
                  onChange={(e) => {
                    void upload(f.name, max, e.target.files);
                    e.target.value = '';
                  }}
                />
                {ids.length > 0 && (
                  <div className={styles.gallery}>
                    {ids.map((id) => (
                      <figure key={id}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/media/${id}`} alt="" />
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            set(
                              f.name,
                              ids.filter((x) => x !== id),
                            )
                          }
                        >
                          Убрать
                        </Button>
                      </figure>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          default:
            return (
              <TextField
                key={f.name}
                {...common}
                type={f.kind}
                value={values[f.name] as string}
                onChange={(e) => set(f.name, e.target.value)}
              />
            );
        }
      })}
      <div>
        <Button type="submit" disabled={busy || uploading}>
          {busy ? 'Отправляем…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
