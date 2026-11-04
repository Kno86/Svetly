'use client';

import { Avatar } from '../../../components/ui/Avatar';
import { useAsk } from '../../../components/ui/Dialog';
import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Alert, Badge, Card, EmptyState, Skeleton } from '../../../components/ui/Feedback';
import { Select, TextField } from '../../../components/ui/Field';
import { useCan, useStaff } from '../../../components/admin/AdminShell';
import { useApi } from '../../../components/admin/useApi';
import { apiRequest, errorMessage } from '../../../lib/auth-client';
import { formatDate } from '../../../lib/content';
import styles from '../../../components/admin/admin.module.css';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  blockedAt: string | null;
  avatarId: string | null;
  createdAt: string;
  roles: Array<{ roleCode: string }>;
}
interface Role {
  code: string;
  name: string;
  rank: number;
}

export default function UsersPage() {
  const me = useStaff();
  const canRoles = useCan('roles.assign');
  const canReadRoles = useCan('roles.read');
  const canBlock = useCan('users.block');
  const canRevoke = useCan('users.sessions.revoke');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const users = useApi<AdminUser[]>(
    `/api/admin/users?limit=50${query ? `&q=${encodeURIComponent(query)}` : ''}`,
  );
  const roles = useApi<Role[]>(canReadRoles ? '/api/admin/roles' : null);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string }>();
  const [dialog, ask] = useAsk();
  const roleName = (code: string) => roles.data?.find((r) => r.code === code)?.name ?? code;
  const grantable = roles.data?.filter((r) => r.code !== 'super_admin') ?? [];

  async function act(
    path: string,
    method: 'POST' | 'DELETE',
    ok: string,
    body: unknown = {},
    confirm?: string,
  ) {
    if (confirm && (await ask({ title: confirm, danger: true })) === undefined) return;
    const r = await apiRequest(path, { method, body: method === 'POST' ? body : undefined });
    setMessage(r.ok ? { tone: 'success', text: ok } : { tone: 'error', text: errorMessage(r) });
    users.reload();
  }

  function search(e: FormEvent) {
    e.preventDefault();
    setQuery(q.trim());
  }

  return (
    <>
      {dialog}
      <div className={styles.head}>
        <h1>Пользователи</h1>
      </div>
      <form className={styles.toolbar} onSubmit={search}>
        <TextField label="Email или имя" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" variant="secondary">
          Найти
        </Button>
      </form>
      <p className={styles.muted}>
        Роли можно назначать только ниже собственного уровня. Супер-администратор создаётся командой
        CLI.
      </p>
      {message && <Alert tone={message.tone} title={message.text} />}
      {users.error && <Alert tone="error" title={users.error} />}
      {users.loading && <Skeleton height="10rem" />}
      {users.data?.length === 0 && (
        <EmptyState title="Никого не найдено" description="Измените запрос." />
      )}
      {users.data?.map((u) => {
        const self = u.id === me.user.id;
        const base = `/api/admin/users/${u.id}`;
        return (
          <Card key={u.id} className={styles.item}>
            <div className={styles.actions}>
              <Avatar name={u.name} avatarId={u.avatarId} />
              <strong>{u.name}</strong>
              <span className={styles.code}>{u.email}</span>
              {!u.emailVerified && <Badge tone="warning">email не подтверждён</Badge>}
              {u.blockedAt && <Badge tone="error">заблокирован</Badge>}
              {self && <Badge>это вы</Badge>}
            </div>
            <p className={styles.muted}>Зарегистрирован {formatDate(u.createdAt)}</p>
            <div className={styles.actions}>
              {u.roles.length === 0 && <span className={styles.muted}>Житель</span>}
              {u.roles.map((r) => (
                <span key={r.roleCode} className={styles.actions}>
                  <Badge tone="info">{roleName(r.roleCode)}</Badge>
                  {canRoles && !self && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Снять роль ${roleName(r.roleCode)}`}
                      onClick={() =>
                        void act(`${base}/roles/${r.roleCode}`, 'DELETE', 'Роль снята.')
                      }
                    >
                      ×
                    </Button>
                  )}
                </span>
              ))}
            </div>
            {!self && (
              <div className={styles.actions}>
                {canRoles && grantable.length > 0 && (
                  <>
                    <Select
                      label="Роль"
                      value={pick[u.id] ?? ''}
                      onChange={(e) => setPick({ ...pick, [u.id]: e.target.value })}
                    >
                      <option value="">—</option>
                      {grantable.map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.name}
                        </option>
                      ))}
                    </Select>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!pick[u.id]}
                      onClick={() =>
                        void act(`${base}/roles`, 'POST', 'Роль назначена.', { role: pick[u.id] })
                      }
                    >
                      Назначить
                    </Button>
                  </>
                )}
                {canBlock &&
                  (u.blockedAt ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void act(`${base}/unblock`, 'POST', 'Разблокирован.')}
                    >
                      Разблокировать
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void act(
                          `${base}/block`,
                          'POST',
                          'Заблокирован, все сессии отозваны.',
                          {},
                          `Заблокировать ${u.email}? Все его сессии будут завершены.`,
                        )
                      }
                    >
                      Заблокировать
                    </Button>
                  ))}
                {canBlock && u.avatarId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void act(
                        `${base}/avatar`,
                        'DELETE',
                        'Фото удалено.',
                        undefined,
                        `Удалить фото профиля ${u.email}?`,
                      )
                    }
                  >
                    Удалить фото
                  </Button>
                )}
                {canRevoke && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void act(`${base}/sessions/revoke`, 'POST', 'Сессии отозваны.')}
                  >
                    Завершить сессии
                  </Button>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </>
  );
}
