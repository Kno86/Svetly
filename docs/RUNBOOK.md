# Runbook

## Локальный запуск

```bash
docker compose up -d --build
docker compose ps        # db, api, web, mailpit — healthy; migrate — Exited (0)
```

Приложение: <http://localhost:3000>. Локальная почта (Mailpit): <http://127.0.0.1:8025>.

Первый Super Admin (один раз, пароль вводится интерактивно):

```bash
docker compose exec api node dist/cli.js admin:create --email you@example.com
```

Подробнее — `docs/AUTH.md` и `docs/RBAC.md`.

Если порт 3000 занят, задайте `WEB_PORT=3001` в `.env`. Основной сценарий всё равно рассчитан на 3000.

## Ручная проверка

1. Откройте <http://localhost:3000>. На странице должны быть «SVETLY», «Технический фундамент проекта (PHASE 1)» и строка «API: готов (версия 0.1.0, …)».
2. `curl http://localhost:3000/healthz` → `{"status":"ok","service":"svetly-web",...}`
3. `curl http://localhost:3000/api/health/ready` → `{"status":"ok","checks":{"database":"ok","migrations":"ok"},"pendingMigrations":[]}`
4. `curl http://localhost:3000/api/version` → `{"service":"svetly-api","version":"0.1.0",...}`
5. Применённые миграции:
   `docker compose exec db psql -U svetly -d svetly -c "select migration_name, finished_at from _prisma_migrations"`
6. Сохранность данных:
   ```bash
   docker compose exec db psql -U svetly -d svetly -tAc "select value from settings where key='instance'"
   docker compose restart        # или: docker compose down && docker compose up -d --build
   docker compose exec db psql -U svetly -d svetly -tAc "select value from settings where key='instance'"
   ```
   В обоих выводах должен быть одинаковый `id`.

Все проверки автоматически выполняет `sh infra/scripts/smoke.sh` (Linux, macOS, Git Bash или WSL).

На Windows в PowerShell используйте `curl.exe` вместо `curl`.

Метаданные сборки на странице можно задать так: `GIT_SHA=$(git rev-parse --short HEAD) BUILD_TIME=$(date -u +%FT%TZ) docker compose up -d --build`. Без них отображается `unknown`.

## Остановка и данные

| Команда                           | Что происходит с данными                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `docker compose stop` / `restart` | сохраняются                                                                                      |
| `docker compose down`             | контейнеры удаляются, volumes `svetly_pgdata`, `svetly_api-secrets` и `svetly_media` сохраняются |
| `docker compose down -v`          | **все данные БД удаляются безвозвратно**; только осознанно                                       |

## Миграции

- Новая миграция (разработка, нужен PostgreSQL): `cd apps/api && DATABASE_URL=... pnpm exec prisma migrate dev --name <name>`
- При каждом `docker compose up` сервис `migrate` выполняет `prisma migrate deploy`: применяет новые миграции, ничего не сбрасывая.
- Статус: `docker compose run --rm migrate pnpm exec prisma migrate status`
- Если миграция упала, `migrate` завершается с ненулевым кодом и `api` не стартует. Причину смотрите в `docker compose logs migrate`.

## Обновление и откат кода

```bash
git pull
docker compose up -d --build
```

Откат: `git checkout <предыдущий-commit> && docker compose up -d --build`. Миграции схемы Prisma не откатывает. Перед обновлением с миграциями обязателен backup (ниже).

## Backup и восстановление

Скрипты требуют bash (Linux, macOS, Git Bash или WSL) и запущенный стек.

```bash
bash infra/scripts/backup.sh                       # backups/svetly-db-<UTC>.dump + .sha256 (папка в .gitignore)
bash infra/scripts/restore-test.sh backups/<файл>.dump   # проверка: восстановление в изолированный проект
bash infra/scripts/restore.sh backups/<файл>.dump        # РАЗРУШИТЕЛЬНО: замена данных текущей БД
```

- `backup.sh`: `pg_dump -Fc` из контейнера `db`, SHA-256, проверка читаемости архива `pg_restore --list`.
- `restore-test.sh`: проверяет SHA-256, поднимает отдельный compose-проект `svetly-restore-test` (свой volume и сеть),
  восстанавливает дамп, проверяет миграции, роли и триггер аудита, затем удаляет **только** тестовый проект.
  Живой стек и `svetly_pgdata` не затрагиваются. Backup считается проверенным только после успешного restore-test.
- `restore.sh`: проверяет SHA-256, требует ввести имя БД для подтверждения, останавливает `api`/`web`, выполняет
  `pg_restore --clean --if-exists --single-transaction` и снова запускает сервисы. Перед ним сделайте свежий backup.
- Секрет авторизации (локально) хранится в volume `svetly_api-secrets`. Если он потерян, все пользователи просто
  войдут заново; в production секрет задаётся переменной `BETTER_AUTH_SECRET` и хранится вне сервера.
- Храните копии вне сервера; расписание (cron) и шифрование внешних копий — задача фазы production-развёртывания.

### Загруженные изображения

`backup.sh` сохраняет только БД. Изображения лежат в volume `svetly_media`; копия:

```bash
docker run --rm -v svetly_media:/media:ro -v "$PWD/backups:/out" alpine tar czf /out/media-$(date +%Y%m%d-%H%M%S).tar.gz -C /media .
```

## Production (подготовлено, не развёрнуто)

1. Создайте `.env.production`: длинный случайный URL-safe `POSTGRES_PASSWORD`, `SVETLY_DOMAIN`, `ACME_EMAIL`. Файл не коммитится.
2. DNS-запись домена указывает на сервер, порты 80 и 443 открыты.
3. `docker compose -f compose.yaml -f compose.prod.yaml --env-file .env.production up -d --build`

Overlay включает `SVETLY_ENV=production` (API откажется стартовать с dev-паролем `*local_dev_only*`), убирает прямую публикацию web и добавляет Caddy с автоматическим HTTPS (`infra/caddy/Caddyfile.prod`).

## Диагностика

| Симптом                                 | Что проверить                                                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `web` не стартует                       | `docker compose ps`: web ждёт healthy `api`                                                                                                            |
| `api` unhealthy                         | `docker compose logs api`; `curl localhost:3000/api/health/ready` покажет причину (`database`/`migrations`)                                            |
| `migrate` exited 1                      | `docker compose logs migrate`                                                                                                                          |
| Ошибки `\r` в shell-скриптах на Windows | `.gitattributes` задаёт LF. Если клон сделан до этого, выполните `git rm --cached -r . && git reset --hard`, только если нет незакоммиченных изменений |
