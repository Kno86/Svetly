# Авторизация (PHASE 3)

## Что реализовано

| Функция                                       | Endpoint (через web, `http://localhost:3000`)                                                          | UI                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| Регистрация email + пароль                    | `POST /api/auth/sign-up/email`                                                                         | `/register`                           |
| Подтверждение email (обязательно до входа)    | письмо → `GET /api/auth/verify-email?token=…` → редирект                                               | `/verify-email`                       |
| Повторная отправка письма                     | `POST /api/auth/send-verification-email` (автоматически при попытке входа)                             | `/login`                              |
| Вход / выход                                  | `POST /api/auth/sign-in/email`, `POST /api/auth/sign-out`                                              | `/login`, `/account`                  |
| Забыли пароль / сброс                         | `POST /api/auth/request-password-reset`, `POST /api/auth/reset-password`                               | `/forgot-password`, `/reset-password` |
| Смена пароля (с завершением остальных сессий) | `POST /api/auth/change-password`                                                                       | `/account` → «Безопасность»           |
| Профиль (имя)                                 | `POST /api/auth/update-user`                                                                           | `/account` → «Профиль»                |
| Список и отзыв сессий                         | `GET /api/auth/list-sessions`, `POST /api/auth/revoke-session`, `POST /api/auth/revoke-other-sessions` | `/account` → «Сессии»                 |
| Текущий пользователь, роли, права             | `GET /api/me`                                                                                          | `/account`                            |

Библиотека: **Better Auth 1.7.10** (через `prismaAdapter`, Prisma 7). Подключена к NestJS/Fastify мостом
`apps/api/src/auth/auth.route.ts` (Fastify → Fetch API `Request`/`Response`). Проверено интеграционными тестами
на реальном PostgreSQL и вручную на Docker-стеке.

## Безопасность

- Пароли: **argon2id** (`@node-rs/argon2`), параметры OWASP m=19 MiB, t=2, p=1; длина 10–128 (для Super Admin в CLI — от 12).
- Сессии хранятся в таблице `sessions` (PostgreSQL), срок 30 дней, продление раз в сутки. Cookie `svetly.session_token`:
  `HttpOnly`, `SameSite=Lax`, подписана секретом; в production — `Secure` и префикс `__Secure-`.
- CSRF: любой `POST /api/auth/*` и любой не-GET запрос к staff API принимается только с `Origin`/`Referer`,
  равным `SVETLY_PUBLIC_URL` (иначе `403 CSRF_ORIGIN_MISMATCH`). Плюс `SameSite=Lax`.
- Rate limit (хранится в БД, таблица `rate_limits`, работает при нескольких экземплярах API без Redis):
  вход 5/мин, регистрация 10/ч, запрос сброса 5/ч, повтор письма 5/ч, смена пароля 5/мин, сброс 10/ч, остальное 100/мин — на IP.
- Сброс пароля завершает все сессии пользователя. Ответ на «забыли пароль» одинаков для существующих и несуществующих адресов.
- Заблокированный пользователь (`users.blocked_at`) не может войти; при блокировке все его сессии удаляются.
- В логах Fastify скрыты `authorization`, `cookie`, `set-cookie`. В журнал аудита не пишутся пароли, токены и email
  (для неудачных входов — только 16 символов SHA-256 от email для корреляции).
- Ограничение: `GET /api/auth/list-sessions` (Better Auth) отдаёт клиенту токены собственных сессий — они нужны для отзыва.
  Без подписи секретом токен не является рабочей cookie.

## Секрет и конфигурация

| Переменная           | Локально                                                                     | Production                                                 |
| -------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `SVETLY_PUBLIC_URL`  | `http://localhost:3000`                                                      | `https://<домен>` (обязательно https)                      |
| `BETTER_AUTH_SECRET` | пусто → случайный секрет генерируется один раз в volume `svetly_api-secrets` | **обязателен**, ≥ 32 символов (`openssl rand -base64 48`)  |
| `SMTP_URL`           | `smtp://mailpit:1025`                                                        | реальный SMTP, напр. `smtps://user:pass@smtp.provider:465` |
| `MAIL_FROM`          | `SVETLY <no-reply@svetly.local>`                                             | обязателен                                                 |

API не стартует в production без секрета или с http-адресом; `compose.prod.yaml` требует все четыре переменные.

## Почта

- **Локально:** Mailpit перехватывает все письма, наружу ничего не уходит. Интерфейс: <http://127.0.0.1:8025>
  (опубликован только на localhost). Ключи и внешние сервисы не нужны.
- **Без SMTP** (`SMTP_URL=`): регистрация и сброс возвращают `503 EMAIL_NOT_CONFIGURED`, в логе API предупреждение.
  Система не делает вид, что письмо отправлено.
- **Production:** нужен SMTP-провайдер с настроенными SPF/DKIM/DMARC для домена отправителя (выбор провайдера — решение владельца).

## Первый Super Admin

Создаётся только командой в контейнере (публичного endpoint нет):

```bash
docker compose exec api node dist/cli.js admin:create --email you@example.com --name "Имя"
```

Пароль вводится дважды интерактивно и не отображается; не попадает в аргументы, переменные окружения, историю shell
и логи. Без TTY (`-T`) команда отказывается работать. Если Super Admin уже есть — ничего не меняет. Email помечается
подтверждённым, назначение роли пишется в аудит (`rbac.role_granted`, `via: cli`).

## Не входит в PHASE 3

VK ID, Telegram Login, 2FA, смена email, удаление/экспорт аккаунта, настройки приватности, UI админки.
