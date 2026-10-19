# Контентная платформа (PHASE 4)

## Принципы

- Публично видно только опубликованное: черновики, `pending`, `rejected` и истёкшие объявления не попадают ни в списки, ни на страницы, ни в поиск (проверяется интеграционными тестами).
- Реальные локальные данные (организации, контакты, события, новости) не выдумываются. Миграция засевает только категории. Пустые разделы показывают честное пустое состояние.
- Флаг `isDemo` есть у всех контентных моделей: демо-записи, если их кто-то создаст, помечаются на сайте бейджем «демо».
- Права проверяет только сервер (`@RequirePermission`), UI лишь скрывает недоступное.

## Модули и статусы

| Модуль               | Таблица             | Статусы                                                  | Кто публикует                                 |
| -------------------- | ------------------- | -------------------------------------------------------- | --------------------------------------------- |
| Новости              | `news_articles`     | `draft`, `published`, `archived`                         | `content.news.manage` (editor, admin)         |
| Объявления           | `announcements`     | `pending`, `published`, `rejected`, `closed`, `archived` | автор; модерация — `moderation.announcements` |
| Организации и услуги | `organizations`     | `draft`, `pending`, `published`, `archived`              | `content.organizations.manage`                |
| События              | `events`            | `draft`, `published`, `cancelled`, `archived`            | `content.events.manage`                       |
| Справочник           | `directory_entries` | `draft`, `published`, `archived`                         | `content.directory.manage`                    |
| Категории            | `categories`        | `active`                                                 | засеяны миграцией; UI управления — PHASE 5    |

У организаций `verification` = `unverified | verified`, плюс `sourceName`, `sourceUrl`, `checkedAt`, `hoursCheckedAt`. Без проверки карточка показывается как «Не проверено».

## Премодерация объявлений

- Пока у автора меньше `settings['moderation.trustedThreshold']` (по умолчанию 3) одобренных объявлений или есть отклонённые — новое объявление получает `pending`.
- Доверенный автор публикуется сразу; правка опубликованного объявления доверенным автором сохраняет публикацию, иначе снова `pending`.
- Не больше 10 объявлений на проверке у одного автора. Срок размещения — 30 дней (`expiresAt`).
- Отклонение и снятие модератором требуют причину; автор видит её в «Мои объявления». Все действия пишутся в audit log.
- UI очереди модерации — PHASE 5; сейчас модерация доступна через API `/api/moderation/announcements`.

## Медиа

- `POST /api/media` — сырое тело `image/jpeg|png|webp`, до 5 МБ, проверяются magic bytes. Только для авторизованных.
- Файлы лежат в volume `svetly_media` (`/var/lib/svetly/media`) за интерфейсом `FileStorage` (`LocalFileStorage`); объектное хранилище подключается новой реализацией интерфейса.
- `GET /api/media/:id` отдаёт файл с `Content-Security-Policy: default-src 'none'` и `nosniff`.
- Прикрепить к объявлению можно только свои изображения (до 6).

## Поиск

PostgreSQL: генерируемые колонки `tsvector` (`russian`) + GIN, `pg_trgm` по заголовкам, fallback `ILIKE`. `GET /api/search?q=&type=&limit=`. Отдельного поискового движка нет.

## Страницы

`/news`, `/news/[slug]`, `/announcements`, `/announcements/[slug]`, `/announcements/new`, `/announcements/[id]/edit`, `/account/announcements`, `/services`, `/services/[slug]`, `/organizations`, `/organizations/[slug]`, `/business` → `/organizations`, `/events` (предстоящие/прошедшие), `/events/[slug]` (запись и отмена), `/directory`, `/search`, `/submit`. Фильтры — обычные GET-формы: работают без JavaScript, состояние в URL.

## Известные ограничения PHASE 4

- Нет UI для редакторов и модераторов (CMS, очередь, категории, настройка порога) — PHASE 5. Сейчас контент создаётся через staff API.
- Жалобы на контент, отзывы и рейтинги, логотипы и обложки организаций, подписки на категории, SEO sitemap/OG-картинки — следующие фазы.
- Поиск без постраничной навигации (до 50 результатов) и без фильтра по категории.
- Отсутствующая новость или событие отдаёт страницу «не найдено» с `noindex`, но HTTP 200 из-за потокового рендеринга (корневой `loading.tsx`).
- `backup.sh` сохраняет только БД; volume `svetly_media` нужно копировать отдельно (см. RUNBOOK).
