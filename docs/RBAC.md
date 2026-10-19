# Роли, права и аудит (PHASE 3)

## Модель

- Таблицы: `roles`, `permissions`, `role_permissions`, `user_roles` (кто и когда выдал — `granted_by_id`, `granted_at`).
- Единственный источник истины — `apps/api/src/rbac/permissions.ts`. Миграция засевает ровно эти данные;
  интеграционный тест падает, если БД и код расходятся. Права модулей добавляются в фазах, которые эти модули реализуют.
- Обычный житель — пользователь без ролей. Гость — без сессии.

| Право                   | super_admin | admin | moderator | editor | support |
| ----------------------- | :---------: | :---: | :-------: | :----: | :-----: |
| `users.read`            |      ✓      |   ✓   |     ✓     |        |    ✓    |
| `users.block`           |      ✓      |   ✓   |           |        |         |
| `users.sessions.revoke` |      ✓      |   ✓   |           |        |         |
| `roles.read`            |      ✓      |   ✓   |           |        |         |
| `roles.assign`          |      ✓      |   ✓   |           |        |         |
| `audit.read`            |      ✓      |   ✓   |           |        |         |

Ранг (`rank`): super_admin 10, admin 20, moderator/editor/support 40. Выдавать/снимать роли и блокировать можно
только пользователей, все роли которых строго ниже собственного ранга, и никогда — себя. `super_admin` через API
не выдаётся вообще (только CLI). Итог: admin не может создать admin или заблокировать другого admin.

## Проверка на сервере

```ts
@Get('audit-log')
@RequirePermission('audit.read') // SessionGuard + PermissionGuard
auditLog() { … }
```

- `SessionGuard`: сессия из cookie → 401 `UNAUTHENTICATED`; заблокирован → 403 `USER_BLOCKED`; не-GET с чужим
  Origin → 403 `CSRF_ORIGIN_MISMATCH`. Роли читаются из БД на каждый запрос (снятие роли действует сразу).
- `PermissionGuard`: нет права → 403 `{"code":"FORBIDDEN","permission":"…"}` и запись `rbac.denied` в аудит.
- Защита от IDOR: собственные данные берутся только из сессии (`/api/me`, сессии Better Auth); операции над чужими
  пользователями доступны лишь staff-эндпоинтам с правом и проверкой ранга цели.

## Staff API (без UI; админ-платформа — следующая фаза)

| Метод  | Путь                                                   | Право                   |
| ------ | ------------------------------------------------------ | ----------------------- |
| GET    | `/api/admin/roles`                                     | `roles.read`            |
| GET    | `/api/admin/users?q=&limit=`                           | `users.read`            |
| POST   | `/api/admin/users/:id/roles` `{"role":"support"}`      | `roles.assign`          |
| DELETE | `/api/admin/users/:id/roles/:role`                     | `roles.assign`          |
| POST   | `/api/admin/users/:id/block`, `/unblock`               | `users.block`           |
| POST   | `/api/admin/users/:id/sessions/revoke`                 | `users.sessions.revoke` |
| GET    | `/api/admin/audit-log?action=&actorId=&before=&limit=` | `audit.read`            |

## Журнал аудита

Таблица `audit_log`: время, `actor_id`, `action`, `entity_type/id`, `outcome` (`success`/`failure`/`denied`),
IP, `request_id`, `metadata` (без паролей, токенов и email). Без внешнего ключа на пользователя — записи переживают удаление.

Пишутся: регистрация, вход (успех и неудача), выход, подтверждение email, запрос и выполнение сброса пароля,
смена пароля, отзыв сессий, выдача/снятие ролей (включая отказы), блокировка/разблокировка, отказ в доступе.

**Только добавление:** триггеры `audit_log_no_update_delete` и `audit_log_no_truncate` отклоняют UPDATE, DELETE и
TRUNCATE на уровне PostgreSQL (проверено тестом и вручную). Отдельная роль БД без прав на изменение — рекомендация для production.

## Права PHASE 5

- `complaints.manage` — super_admin, admin, moderator, support.
- `organizations.verify` — super_admin, admin.
- `settings.manage` — super_admin, admin.

## Права PHASE 6

- `moderation.community` — super_admin, admin, moderator (вакансии, «Потеряно и найдено»).
- `issues.manage` — super_admin, admin, moderator, support (статусы, приоритет, ответственный, внутренние заметки).
- `issues.respond` — super_admin, admin (публичный ответ платформы по обращению).
- `polls.manage` — super_admin, admin, editor.
- `business.review` — super_admin, admin (заявки бизнеса и изменения карточек владельцами).

Владелец карточки — не роль: доступ к `/api/business/*` проверяется по `organizations.owner_id`. Подробнее — [COMMUNITY.md](COMMUNITY.md), [BUSINESS.md](BUSINESS.md).

Матрица разделов админки — в [ADMIN.md](ADMIN.md).
