-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "module" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "owner_id" UUID,
    "storage_key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "alt" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_articles" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "cover_id" UUID,
    "category_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "source_name" TEXT,
    "source_url" TEXT,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "author_id" UUID,
    "updated_by_id" UUID,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "news_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "price" INTEGER,
    "condition" TEXT,
    "area" TEXT,
    "contact_phone" TEXT,
    "image_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "moderation_note" TEXT,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "author_id" UUID NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "slug" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'organization',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "services" TEXT NOT NULL DEFAULT '',
    "category_id" UUID,
    "phone" TEXT,
    "website" TEXT,
    "address" TEXT,
    "service_area" TEXT,
    "hours" TEXT,
    "hours_checked_at" TIMESTAMPTZ(6),
    "verification" TEXT NOT NULL DEFAULT 'unverified',
    "source_name" TEXT,
    "source_url" TEXT,
    "checked_at" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "owner_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "organizer" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6),
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Novosibirsk',
    "registration_url" TEXT,
    "capacity" INTEGER,
    "category_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_registrations" (
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("event_id","user_id")
);

-- CreateTable
CREATE TABLE "directory_entries" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'contact',
    "body" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "url" TEXT,
    "category_id" UUID,
    "source_name" TEXT,
    "source_url" TEXT,
    "checked_at" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "directory_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_module_slug_key" ON "categories"("module", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storage_key_key" ON "media_assets"("storage_key");

-- CreateIndex
CREATE INDEX "media_assets_owner_id_idx" ON "media_assets"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "news_articles_slug_key" ON "news_articles"("slug");

-- CreateIndex
CREATE INDEX "news_articles_status_published_at_idx" ON "news_articles"("status", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "announcements_slug_key" ON "announcements"("slug");

-- CreateIndex
CREATE INDEX "announcements_status_published_at_idx" ON "announcements"("status", "published_at");

-- CreateIndex
CREATE INDEX "announcements_author_id_idx" ON "announcements"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_status_kind_idx" ON "organizations"("status", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_status_starts_at_idx" ON "events"("status", "starts_at");

-- CreateIndex
CREATE INDEX "event_registrations_user_id_idx" ON "event_registrations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "directory_entries_slug_key" ON "directory_entries"("slug");

-- CreateIndex
CREATE INDEX "directory_entries_status_position_idx" ON "directory_entries"("status", "position");

-- AddForeignKey
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directory_entries" ADD CONSTRAINT "directory_entries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Statuses / enums as CHECK constraints
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_status_check" CHECK ("status" IN ('draft','published','archived'));
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_status_check" CHECK ("status" IN ('pending','published','rejected','closed','archived'));
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_status_check" CHECK ("status" IN ('draft','pending','published','archived'));
ALTER TABLE "events" ADD CONSTRAINT "events_status_check" CHECK ("status" IN ('draft','published','cancelled','archived'));
ALTER TABLE "directory_entries" ADD CONSTRAINT "directory_entries_status_check" CHECK ("status" IN ('draft','published','archived'));
ALTER TABLE "categories" ADD CONSTRAINT "categories_module_check" CHECK ("module" IN ('news','announcements','services','organizations','events','directory'));
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_kind_check" CHECK ("kind" IN ('organization','service'));
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_verification_check" CHECK ("verification" IN ('unverified','verified'));
ALTER TABLE "directory_entries" ADD CONSTRAINT "directory_entries_kind_check" CHECK ("kind" IN ('contact','emergency','instruction','link','document'));
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_price_check" CHECK ("price" IS NULL OR "price" >= 0);
ALTER TABLE "events" ADD CONSTRAINT "events_capacity_check" CHECK ("capacity" IS NULL OR "capacity" > 0);
ALTER TABLE "events" ADD CONSTRAINT "events_dates_check" CHECK ("ends_at" IS NULL OR "ends_at" >= "starts_at");

-- Full-text search (Russian stemming) + trigram fallback for short/partial queries
CREATE EXTENSION IF NOT EXISTS pg_trgm;
ALTER TABLE "news_articles" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('russian', coalesce("title", '')), 'A') || setweight(to_tsvector('russian', coalesce("excerpt", '')), 'B') || setweight(to_tsvector('russian', coalesce("body", '')), 'C')) STORED;
CREATE INDEX "news_articles_search_idx" ON "news_articles" USING GIN ("search");
CREATE INDEX "news_articles_title_trgm_idx" ON "news_articles" USING GIN ("title" gin_trgm_ops);
ALTER TABLE "announcements" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('russian', coalesce("title", '')), 'A') || setweight(to_tsvector('russian', coalesce("description", '')), 'C')) STORED;
CREATE INDEX "announcements_search_idx" ON "announcements" USING GIN ("search");
CREATE INDEX "announcements_title_trgm_idx" ON "announcements" USING GIN ("title" gin_trgm_ops);
ALTER TABLE "organizations" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('russian', coalesce("name", '')), 'A') || setweight(to_tsvector('russian', coalesce("services", '')), 'B') || setweight(to_tsvector('russian', coalesce("description", '')), 'C')) STORED;
CREATE INDEX "organizations_search_idx" ON "organizations" USING GIN ("search");
CREATE INDEX "organizations_title_trgm_idx" ON "organizations" USING GIN ("name" gin_trgm_ops);
ALTER TABLE "events" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('russian', coalesce("title", '')), 'A') || setweight(to_tsvector('russian', coalesce("description", '')), 'C')) STORED;
CREATE INDEX "events_search_idx" ON "events" USING GIN ("search");
CREATE INDEX "events_title_trgm_idx" ON "events" USING GIN ("title" gin_trgm_ops);
ALTER TABLE "directory_entries" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('russian', coalesce("title", '')), 'A') || setweight(to_tsvector('russian', coalesce("body", '')), 'C')) STORED;
CREATE INDEX "directory_entries_search_idx" ON "directory_entries" USING GIN ("search");
CREATE INDEX "directory_entries_title_trgm_idx" ON "directory_entries" USING GIN ("title" gin_trgm_ops);

-- RBAC: PHASE 4 permissions (mirrors src/rbac/permissions.ts)
INSERT INTO "permissions" ("code", "description") VALUES
  ('content.news.manage', 'Создание, редактирование и публикация новостей'),
  ('content.events.manage', 'Создание, редактирование и публикация событий'),
  ('content.organizations.manage', 'Управление карточками организаций и услуг'),
  ('content.directory.manage', 'Управление полезным справочником'),
  ('content.categories.manage', 'Управление категориями модулей'),
  ('moderation.announcements', 'Модерация объявлений жителей (одобрение, отклонение, снятие)');
INSERT INTO "role_permissions" ("role_code", "permission_code") VALUES
  ('super_admin', 'content.news.manage'),
  ('super_admin', 'content.events.manage'),
  ('super_admin', 'content.organizations.manage'),
  ('super_admin', 'content.directory.manage'),
  ('super_admin', 'content.categories.manage'),
  ('super_admin', 'moderation.announcements'),
  ('admin', 'content.news.manage'),
  ('admin', 'content.events.manage'),
  ('admin', 'content.organizations.manage'),
  ('admin', 'content.directory.manage'),
  ('admin', 'content.categories.manage'),
  ('admin', 'moderation.announcements'),
  ('editor', 'content.news.manage'),
  ('editor', 'content.events.manage'),
  ('editor', 'content.organizations.manage'),
  ('editor', 'content.directory.manage'),
  ('moderator', 'moderation.announcements');

-- Navigational categories (configurable later in the admin platform; not content)
INSERT INTO "categories" ("module", "slug", "name", "position") VALUES
  ('announcements', 'prodam', 'Продам', 0),
  ('announcements', 'kuplyu', 'Куплю', 10),
  ('announcements', 'otdam-darom', 'Отдам даром', 20),
  ('announcements', 'uslugi', 'Услуги', 30),
  ('announcements', 'arenda', 'Аренда', 40),
  ('announcements', 'nedvizhimost', 'Недвижимость', 50),
  ('announcements', 'transport', 'Транспорт', 60),
  ('announcements', 'elektronika', 'Электроника', 70),
  ('announcements', 'bytovaya-tehnika', 'Бытовая техника', 80),
  ('announcements', 'mebel', 'Мебель', 90),
  ('announcements', 'dlya-doma', 'Товары для дома', 100),
  ('announcements', 'odezhda', 'Одежда', 110),
  ('announcements', 'detskie-tovary', 'Детские товары', 120),
  ('announcements', 'zhivotnye', 'Животные', 130),
  ('announcements', 'rabota', 'Работа', 140),
  ('announcements', 'poteryano-naideno', 'Потеряно/найдено', 150),
  ('announcements', 'drugoe', 'Другое', 160),
  ('services', 'remont', 'Ремонт', 0),
  ('services', 'stroitelstvo', 'Строительство', 10),
  ('services', 'santehnika', 'Сантехника', 20),
  ('services', 'elektrika', 'Электрика', 30),
  ('services', 'uborka', 'Уборка', 40),
  ('services', 'dostavka', 'Доставка', 50),
  ('services', 'perevozki', 'Перевозки', 60),
  ('services', 'remont-tehniki', 'Ремонт техники', 70),
  ('services', 'krasota', 'Красота', 80),
  ('services', 'obuchenie', 'Обучение', 90),
  ('services', 'zdorove', 'Здоровье', 100),
  ('services', 'avtoservis', 'Автосервис', 110),
  ('services', 'arenda-oborudovaniya', 'Аренда оборудования', 120),
  ('services', 'drugoe', 'Другое', 130),
  ('organizations', 'magaziny', 'Магазины', 0),
  ('organizations', 'obrazovanie', 'Образование', 10),
  ('organizations', 'zdorove', 'Здоровье', 20),
  ('organizations', 'kafe', 'Кафе и питание', 30),
  ('organizations', 'bytovye-uslugi', 'Бытовые услуги', 40),
  ('organizations', 'uchrezhdeniya', 'Учреждения', 50),
  ('organizations', 'drugoe', 'Другое', 60),
  ('news', 'vazhnoe', 'Важное', 0),
  ('news', 'obshchestvo', 'Общество', 10),
  ('news', 'blagoustroystvo', 'Благоустройство', 20),
  ('news', 'transport', 'Транспорт', 30),
  ('news', 'obrazovanie', 'Образование', 40),
  ('news', 'kultura', 'Культура', 50),
  ('news', 'sport', 'Спорт', 60),
  ('events', 'prazdniki', 'Праздники', 0),
  ('events', 'kultura', 'Культура', 10),
  ('events', 'sport', 'Спорт', 20),
  ('events', 'deti', 'Для детей', 30),
  ('events', 'vstrechi', 'Встречи жителей', 40),
  ('directory', 'ekstrennye', 'Экстренные службы', 0),
  ('directory', 'zhkh', 'ЖКХ', 10),
  ('directory', 'transport', 'Транспорт', 20),
  ('directory', 'zdorove', 'Здоровье', 30),
  ('directory', 'obrazovanie', 'Образование', 40),
  ('directory', 'uchrezhdeniya', 'Учреждения', 50),
  ('directory', 'instrukcii', 'Инструкции', 60);

-- Moderation policy: announcements of authors with fewer approved posts are premoderated
INSERT INTO "settings" ("key", "value", "updated_at") VALUES ('moderation.trustedThreshold', '3', now()) ON CONFLICT ("key") DO NOTHING;
