# SVETLY

Цифровая платформа для жителей посёлка Октябрьский и жилого района Светлый (Мошковский район, Новосибирская область). Проект создаётся с нуля и развивается по фазам.

**Текущий статус: PHASE 1 — технический фундамент.** Публичных разделов, бизнес-модулей, дизайн-системы и админки пока нет.

## Быстрый старт (Windows + Docker Desktop, macOS, Linux)

Нужен только Docker Desktop (или Docker Engine с Compose v2.24+). Node.js на хосте не обязателен.

```bash
git clone https://github.com/Kno86/Svetly.git
cd Svetly
docker compose up -d --build
```

Откройте <http://localhost:3000>. На технической странице видна версия web и статус API.

Файл `.env` не нужен: для локального запуска используются безопасные значения по умолчанию. Чтобы их переопределить, скопируйте `.env.example` в `.env`.

| Проверка                       | Команда                                       |
| ------------------------------ | --------------------------------------------- |
| Состояние сервисов             | `docker compose ps`                           |
| Web healthcheck                | `curl http://localhost:3000/healthz`          |
| Готовность API (БД и миграции) | `curl http://localhost:3000/api/health/ready` |
| Версия API                     | `curl http://localhost:3000/api/version`      |
| Логи                           | `docker compose logs -f api web`              |
| Остановка (данные сохраняются) | `docker compose down`                         |

На Windows в PowerShell используйте `curl.exe` вместо `curl`.

Подробности: [docs/RUNBOOK.md](docs/RUNBOOK.md).

## Состав

```text
apps/api     NestJS 12 REST API (Fastify), Prisma 7, миграции PostgreSQL
apps/web     Next.js 16 (App Router): публичный сайт, кабинеты и админка в будущих фазах
infra/docker Dockerfile для api (runtime + migrate) и web
infra/caddy  Конфигурация Caddy для production (HTTPS)
infra/scripts Скрипт smoke-проверки
docs/        Архитектура, runbook, безопасность, roadmap
```

## Разработка без Docker (опционально)

Нужны Node.js 24.22.0 (см. `.nvmrc`), pnpm 12.14.0 и доступный PostgreSQL 18.

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
DATABASE_URL=postgresql://... pnpm test:integration
```

## Документация

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): архитектура и зафиксированные версии
- [docs/RUNBOOK.md](docs/RUNBOOK.md): запуск, проверка, обновление, откат, production
- [docs/SECURITY.md](docs/SECURITY.md): секреты, авторизация, email-процессы
- [docs/ROADMAP.md](docs/ROADMAP.md): фазы и решения владельца
