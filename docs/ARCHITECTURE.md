# Архитектура SVETLY (PHASE 1)

## Принципы

- Проект создаётся с нуля. Код, интерфейс, Docker-ресурсы и архитектура предыдущей реализации (Grok) не используются.
- **Модульный монолит.** Один NestJS API с доменными модулями. Отдельный worker появится только тогда, когда без него не обойтись (очереди уведомлений, обработка медиа).
- **API — единственная граница доступа к данным.** Next.js не подключается к PostgreSQL напрямую.
- **Авторизация на сервере.** Каждая защищённая операция проверяется в API; скрытие элементов в UI безопасностью не считается.
- **Минимум инфраструктуры.** Redis, MinIO и отдельного поискового движка нет. Поиск строится на PostgreSQL (FTS + `pg_trgm`) в соответствующей фазе.
- **Файловое хранилище через интерфейс.** Будущий модуль загрузок определит интерфейс `StorageDriver` с реализациями `local` (Docker volume) и `s3` (S3-совместимое хранилище). Код домена не будет зависеть от конкретного драйвера. В PHASE 1 загрузок файлов нет.

## Топология

```text
Локально (compose.yaml)

  браузер ──► :3000 web (Next.js standalone)
                    ├─ страницы (SSR)
                    └─ /api/* ──rewrite──► api:4000 (NestJS) ──► db:5432 (PostgreSQL 18)
                                                                ▲
                                          migrate (prisma migrate deploy, one-shot)

Production (compose.yaml + compose.prod.yaml)

  браузер ──► :443 caddy ──► /api/*  ──► api:4000
                         └─► /*      ──► web:3000
```

- На хост публикуется только порт web (`WEB_PORT`, по умолчанию 3000). API и PostgreSQL доступны лишь во внутренней сети `backend`, поэтому с занятыми портами 4000/5432 на хосте они не конфликтуют.
- Порядок запуска задаётся через healthchecks: `db` (healthy) → `migrate` (exit 0) → `api` (healthy, `/api/health/ready`) → `web` (healthy, `/healthz`).
- Миграции только применяются (`prisma migrate deploy`). Сброса базы при запуске нет.
- Данные PostgreSQL лежат в именованном volume `svetly_pgdata`, смонтированном в `/var/lib/postgresql` (в образах PostgreSQL 18 PGDATA находится в `/var/lib/postgresql/18/docker`).

## Endpoints PHASE 1

| Endpoint                | Назначение                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `GET /api/health/live`  | Процесс API жив                                                                         |
| `GET /api/health/ready` | Проверяет `SELECT 1` и то, что все миграции из образа применены. Возвращает 200 или 503 |
| `GET /api/version`      | Сервис, версия пакета, `GIT_SHA`, `BUILD_TIME`                                          |
| `GET /healthz` (web)    | Web-процесс жив, метаданные сборки                                                      |

Начиная с PHASE 3 добавлены `/api/auth/*` (Better Auth), `GET /api/me` и staff API `/api/admin/*` — см. `docs/AUTH.md` и `docs/RBAC.md`. Сервис `mailpit` (только локально) перехватывает письма.

При первом запуске API создаёт в таблице `settings` запись `instance` (UUID и время инициализации). Повторные запуски её не перезаписывают, поэтому она служит проверкой сохранности данных после перезапуска.

## Зафиксированные версии

| Компонент                                            | Версия                                                   |
| ---------------------------------------------------- | -------------------------------------------------------- |
| Node.js                                              | 24.22.0 (`node:24.22.0-alpine3.24`, `.nvmrc`, `engines`) |
| pnpm                                                 | 12.14.0 (`packageManager`)                               |
| TypeScript                                           | 6.0.3                                                    |
| Next.js                                              | 16.4.2                                                   |
| React / React DOM                                    | 19.3.1                                                   |
| NestJS (`common`, `core`, `platform-fastify`)        | 12.1.3                                                   |
| Fastify                                              | 5.12.5                                                   |
| Prisma CLI / `@prisma/client` / `@prisma/adapter-pg` | 7.10.1                                                   |
| `pg`                                                 | 8.23.1                                                   |
| PostgreSQL                                           | 18.6 (`postgres:18.6-alpine3.24`)                        |
| Caddy (только production)                            | 2.11.7 (`caddy:2.11.7-alpine`)                           |
| Vitest                                               | 5.0.5                                                    |
| ESLint / typescript-eslint                           | 9.39.5 / 8.71.2                                          |
| Prettier                                             | 3.9.10                                                   |

Все прямые зависимости указаны точными версиями (`saveExact: true`), транзитивные зафиксированы в `pnpm-lock.yaml`. Docker-сборка использует `--frozen-lockfile`.

Почему не последние major-версии:

- **Prisma 8:** в npm `latest` указывает на `8.0.0-rc.*`. По решению владельца Release Candidate не используется. К переходу вернёмся после стабильного релиза и проверки совместимости.
- **TypeScript 7:** вышел недавно. 6.0.3 — проверенная ветка, совместимая с Next.js 16, NestJS 12 и Prisma 7.

## Модули API

NestJS 12 распространяется только как ESM, поэтому `apps/api` — ESM-пакет (`"type": "module"`, `module: NodeNext`). Prisma Client генерируется в `src/generated/prisma` (в git не хранится) через драйвер-адаптер `@prisma/adapter-pg`.

```text
apps/api/src
├─ config/    загрузка и валидация окружения (production не принимает dev-учётные данные БД)
├─ prisma/    PrismaService (глобальный)
├─ health/    live/ready, проверка миграций
├─ instance/  постоянная запись instance (проверка сохранности данных)
├─ version/   /api/version
├─ audit/     AuditService (журнал только на добавление)
├─ auth/      Better Auth (мост Fastify → Fetch), почта, SessionGuard/PermissionGuard, /api/me, /api/admin
├─ rbac/      роли и права (единственный источник истины, засевается миграцией)
├─ common/    валидация входных данных (zod → 400 VALIDATION_FAILED)
├─ content/   публичный контент, объявления и модерация, staff CRUD, события, медиа, поиск
└─ cli.ts     node dist/cli.js admin:create
```

Зависимости авторизации (зафиксированы): `better-auth` 1.7.10, `@node-rs/argon2` 2.2.2, `nodemailer` 10.0.16, `zod` 4.6.7; Mailpit `axllent/mailpit:v1.29.6`.

С PHASE 4 добавлены контентные модули — см. `docs/CONTENT.md`. Админ-платформа (UI модерации и CMS) — PHASE 5.
