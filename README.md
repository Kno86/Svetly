# SVETLY

Цифровая платформа для жителей посёлка Октябрьский и жилого района Светлый (Мошковский район, Новосибирская область). Проект создаётся с нуля и развивается по фазам.

**Текущий статус:** все фазы ТЗ и редизайн «Рассвет» реализованы, проект готов к локальному тестированию. Публичный запуск ждёт решений владельца: домен, хостинг, SMTP, мониторинг, юридические тексты (см. [docs/LAUNCH.md](docs/LAUNCH.md)). Реальных данных в базе нет: пустые разделы показывают честные пустые состояния.

## Быстрый старт (Windows + Docker Desktop, macOS, Linux)

Нужен только Docker Desktop (или Docker Engine с Compose v2.24+). Node.js на хосте не обязателен.

```bash
git clone https://github.com/Kno86/Svetly.git
cd Svetly
docker compose up -d --build
```

Откройте <http://localhost:3000>. Внизу главной страницы показаны версия web и статус API.

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

### Локальное тестирование

1. Регистрация: <http://localhost:3000/register>. Письма не уходят наружу, их ловит Mailpit: <http://localhost:8025>. Откройте письмо и перейдите по ссылке подтверждения.
2. Администратор (пароль вводится скрыто):

   ```bash
   docker compose exec api node dist/cli.js admin:create --email you@example.com --name "Имя"
   ```

   Админка: <http://localhost:3000/admin>.

3. Кабинет жителя: `/account`, кабинет бизнеса: `/business`.
4. Демо-наполнение — по одной вымышленной записи с пометкой «Демо» в каждом разделе (без телефонов, адресов и реальных названий):

   ```bash
   docker compose exec api node dist/cli.js demo:seed    # добавить
   docker compose exec api node dist/cli.js demo:clear   # удалить все демо-записи
   ```

5. Сбросить всё, включая базу: `docker compose down -v`.

Подробности: [docs/RUNBOOK.md](docs/RUNBOOK.md).

## Состав

```text
apps/api     NestJS 12 REST API (Fastify), Prisma 7, миграции PostgreSQL
apps/web     Next.js 16 (App Router): публичный сайт, кабинеты жителя и бизнеса, админка
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
