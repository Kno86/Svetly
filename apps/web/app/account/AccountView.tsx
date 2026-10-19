'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import styles from '../../components/auth/auth.module.css';
import { Button } from '../../components/ui/Button';
import { Alert, Badge, Card, Skeleton } from '../../components/ui/Feedback';
import { TextField } from '../../components/ui/Field';
import { Tabs } from '../../components/ui/Navigation';
import { apiRequest, errorMessage, MIN_PASSWORD_LENGTH } from '../../lib/auth-client';

interface Me {
  user: { id: string; name: string; email: string; emailVerified: boolean; createdAt: string };
  roles: string[];
  permissions: string[];
}
interface SessionInfo {
  id: string;
  token: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}

const ROLE_NAMES: Record<string, string> = {
  super_admin: 'Супер-администратор',
  admin: 'Администратор',
  moderator: 'Модератор',
  editor: 'Редактор',
  support: 'Поддержка',
};
const dateFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });

export function AccountView() {
  const router = useRouter();
  const [me, setMe] = useState<Me>();
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    void apiRequest<Me>('/api/me').then((result) => {
      if (result.status === 401) router.replace('/login');
      else if (result.ok) setMe(result.data);
      else setLoadError(errorMessage(result));
    });
  }, [router]);

  async function signOut() {
    await apiRequest('/api/auth/sign-out', { body: {} });
    router.push('/');
    router.refresh();
  }

  return (
    <main id="main" className={`container ${styles.page}`}>
      <div className={styles.wide}>
        <h1>Личный кабинет</h1>
        {loadError && (
          <Alert tone="error" title="Не удалось загрузить данные">
            {loadError}
          </Alert>
        )}
        {!me && !loadError && <Skeleton height="12rem" />}
        {me && (
          <>
            <div className={styles.section}>
              <Tabs
                label="Разделы кабинета"
                tabs={[
                  {
                    id: 'profile',
                    label: 'Профиль',
                    content: (
                      <Profile
                        me={me}
                        onSaved={(name) => setMe({ ...me, user: { ...me.user, name } })}
                      />
                    ),
                  },
                  { id: 'security', label: 'Безопасность', content: <Security /> },
                  { id: 'sessions', label: 'Сессии', content: <Sessions /> },
                ]}
              />
            </div>
            <div className={styles.section}>
              <Button variant="secondary" onClick={signOut}>
                Выйти
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Profile({ me, onSaved }: { me: Me; onSaved: (name: string) => void }) {
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name')).trim();
    setBusy(true);
    const result = await apiRequest('/api/auth/update-user', { body: { name } });
    setBusy(false);
    if (result.ok) {
      onSaved(name);
      setStatus({ tone: 'success', text: 'Имя сохранено.' });
    } else setStatus({ tone: 'error', text: errorMessage(result) });
  }

  return (
    <Card className={styles.section}>
      <h2>Профиль</h2>
      <dl className={styles.dl}>
        <dt>Email</dt>
        <dd>
          {me.user.email}{' '}
          {me.user.emailVerified ? (
            <Badge tone="success">подтверждён</Badge>
          ) : (
            <Badge tone="warning">не подтверждён</Badge>
          )}
        </dd>
        <dt>Зарегистрирован</dt>
        <dd>{dateFormat.format(new Date(me.user.createdAt))}</dd>
        <dt>Роли</dt>
        <dd>{me.roles.length ? me.roles.map((r) => ROLE_NAMES[r] ?? r).join(', ') : 'Житель'}</dd>
      </dl>
      {me.permissions.length > 0 && (
        <p>
          <Link href="/admin">Открыть админ-платформу</Link>
        </p>
      )}
      <form className={styles.form} onSubmit={onSubmit}>
        {status && <Alert tone={status.tone} title={status.text} />}
        <TextField
          label="Имя"
          name="name"
          defaultValue={me.user.name}
          maxLength={100}
          autoComplete="name"
          required
        />
        <div>
          <Button type="submit" loading={busy}>
            Сохранить
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Security() {
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string }>();
  const [mismatch, setMismatch] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const newPassword = String(form.get('newPassword'));
    if (newPassword !== String(form.get('confirm'))) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    setBusy(true);
    const result = await apiRequest('/api/auth/change-password', {
      body: {
        currentPassword: String(form.get('currentPassword')),
        newPassword,
        revokeOtherSessions: true,
      },
    });
    setBusy(false);
    if (result.ok) {
      formElement.reset();
      setStatus({ tone: 'success', text: 'Пароль изменён. Остальные сессии завершены.' });
    } else setStatus({ tone: 'error', text: errorMessage(result) });
  }

  return (
    <Card className={styles.section}>
      <h2>Смена пароля</h2>
      <form className={styles.form} onSubmit={onSubmit}>
        {status && <Alert tone={status.tone} title={status.text} />}
        <TextField
          label="Текущий пароль"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
        <TextField
          label="Новый пароль"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          maxLength={128}
          hint={`Не меньше ${MIN_PASSWORD_LENGTH} символов.`}
          required
        />
        <TextField
          label="Повторите новый пароль"
          name="confirm"
          type="password"
          autoComplete="new-password"
          error={mismatch ? 'Пароли не совпадают.' : undefined}
          required
        />
        <div>
          <Button type="submit" loading={busy}>
            Сменить пароль
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Sessions() {
  const [sessions, setSessions] = useState<SessionInfo[]>();
  const [current, setCurrent] = useState<string>();
  const [error, setError] = useState<string>();

  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      apiRequest<SessionInfo[]>('/api/auth/list-sessions'),
      apiRequest<{ session: { id: string } } | null>('/api/auth/get-session'),
    ]).then(([list, active]) => {
      if (cancelled) return;
      if (list.ok && list.data) {
        setSessions([...list.data].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      } else setError(errorMessage(list));
      setCurrent(active.data?.session.id);
    });
    return () => {
      cancelled = true;
    };
  }, [version]);

  async function revoke(path: string, body: unknown) {
    const result = await apiRequest(path, { body });
    if (!result.ok) setError(errorMessage(result));
    setVersion((v) => v + 1);
  }

  return (
    <Card className={styles.section}>
      <h2>Активные сессии</h2>
      {error && (
        <Alert tone="error" title="Ошибка">
          {error}
        </Alert>
      )}
      {!sessions && !error && <Skeleton height="6rem" />}
      {sessions && (
        <ul className={styles.sessionList}>
          {sessions.map((s) => (
            <li key={s.id} className={styles.session}>
              <div>
                <div>
                  {describeAgent(s.userAgent)}{' '}
                  {s.id === current && <Badge tone="brand">это устройство</Badge>}
                </div>
                <div className={styles.meta}>
                  Вход: {dateFormat.format(new Date(s.createdAt))} · активность:{' '}
                  {dateFormat.format(new Date(s.updatedAt))}
                </div>
              </div>
              {s.id !== current && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => revoke('/api/auth/revoke-session', { token: s.token })}
                >
                  Завершить
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {sessions && sessions.length > 1 && (
        <div className={styles.section}>
          <Button variant="danger" onClick={() => revoke('/api/auth/revoke-other-sessions', {})}>
            Завершить все, кроме текущей
          </Button>
        </div>
      )}
    </Card>
  );
}

function describeAgent(agent?: string | null): string {
  if (!agent) return 'Неизвестное устройство';
  const browser = /Edg\//.test(agent)
    ? 'Edge'
    : /Firefox\//.test(agent)
      ? 'Firefox'
      : /Chrome\//.test(agent)
        ? 'Chrome'
        : /Safari\//.test(agent)
          ? 'Safari'
          : 'Браузер';
  const os = /Windows/.test(agent)
    ? 'Windows'
    : /Android/.test(agent)
      ? 'Android'
      : /iPhone|iPad/.test(agent)
        ? 'iOS'
        : /Mac OS/.test(agent)
          ? 'macOS'
          : /Linux/.test(agent)
            ? 'Linux'
            : '';
  return os ? `${browser}, ${os}` : browser;
}
