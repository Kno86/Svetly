-- PHASE 6: business cabinet, inquiries, jobs, lost & found, territory issues, polls

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "pending_changes" JSONB,
ADD COLUMN     "review_note" TEXT,
ADD COLUMN     "submitted_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "business_inquiries" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "contact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "reply" TEXT,
    "replied_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "employer" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "conditions" TEXT NOT NULL DEFAULT '',
    "requirements" TEXT NOT NULL DEFAULT '',
    "salary" TEXT,
    "schedule" TEXT,
    "area" TEXT,
    "contact_phone" TEXT,
    "contact_note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "moderation_note" TEXT,
    "author_id" UUID NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lost_found" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "slug" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "area" TEXT,
    "happened_on" DATE,
    "image_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "contact_phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "moderation_note" TEXT,
    "author_id" UUID NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lost_found_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "number" SERIAL NOT NULL,
    "reporter_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "address" TEXT,
    "image_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "contact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'received',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "assignee_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_updates" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "issue_id" UUID NOT NULL,
    "author_id" UUID,
    "kind" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "polls" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "mode" TEXT NOT NULL DEFAULT 'anonymous',
    "allow_revote" BOOLEAN NOT NULL DEFAULT false,
    "opens_at" TIMESTAMPTZ(6) NOT NULL,
    "closes_at" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_options" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "poll_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_votes" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "poll_id" UUID NOT NULL,
    "option_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_inquiries_organization_id_created_at_idx" ON "business_inquiries"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "business_inquiries_sender_id_idx" ON "business_inquiries"("sender_id");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_slug_key" ON "jobs"("slug");

-- CreateIndex
CREATE INDEX "jobs_status_published_at_idx" ON "jobs"("status", "published_at");

-- CreateIndex
CREATE INDEX "jobs_author_id_idx" ON "jobs"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "lost_found_slug_key" ON "lost_found"("slug");

-- CreateIndex
CREATE INDEX "lost_found_status_published_at_idx" ON "lost_found"("status", "published_at");

-- CreateIndex
CREATE INDEX "lost_found_author_id_idx" ON "lost_found"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "issues_number_key" ON "issues"("number");

-- CreateIndex
CREATE INDEX "issues_status_created_at_idx" ON "issues"("status", "created_at");

-- CreateIndex
CREATE INDEX "issues_reporter_id_idx" ON "issues"("reporter_id");

-- CreateIndex
CREATE INDEX "issue_updates_issue_id_created_at_idx" ON "issue_updates"("issue_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "polls_slug_key" ON "polls"("slug");

-- CreateIndex
CREATE INDEX "polls_status_opens_at_idx" ON "polls"("status", "opens_at");

-- CreateIndex
CREATE INDEX "poll_options_poll_id_idx" ON "poll_options"("poll_id");

-- CreateIndex
CREATE INDEX "poll_votes_option_id_idx" ON "poll_votes"("option_id");

-- CreateIndex
CREATE UNIQUE INDEX "poll_votes_poll_id_user_id_key" ON "poll_votes"("poll_id", "user_id");

-- CreateIndex
CREATE INDEX "organizations_owner_id_idx" ON "organizations"("owner_id");

-- AddForeignKey
ALTER TABLE "business_inquiries" ADD CONSTRAINT "business_inquiries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_updates" ADD CONSTRAINT "issue_updates_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "poll_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Statuses / enums as CHECK constraints
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_status_check";
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_status_check" CHECK ("status" IN ('draft','pending','needs_info','rejected','published','archived'));
ALTER TABLE "business_inquiries" ADD CONSTRAINT "business_inquiries_status_check" CHECK ("status" IN ('new','answered','closed'));
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_status_check" CHECK ("status" IN ('pending','published','rejected','closed','archived'));
ALTER TABLE "lost_found" ADD CONSTRAINT "lost_found_status_check" CHECK ("status" IN ('pending','published','rejected','resolved','closed','archived'));
ALTER TABLE "lost_found" ADD CONSTRAINT "lost_found_kind_check" CHECK ("kind" IN ('lost','found'));
ALTER TABLE "lost_found" ADD CONSTRAINT "lost_found_subject_check" CHECK ("subject" IN ('item','animal'));
ALTER TABLE "issues" ADD CONSTRAINT "issues_status_check" CHECK ("status" IN ('received','reviewing','assigned','in_progress','resolved','closed','rejected'));
ALTER TABLE "issues" ADD CONSTRAINT "issues_priority_check" CHECK ("priority" IN ('low','normal','high'));
ALTER TABLE "issues" ADD CONSTRAINT "issues_category_check" CHECK ("category" IN ('roads','lighting','waste','water','landscaping','safety','other'));
ALTER TABLE "issue_updates" ADD CONSTRAINT "issue_updates_kind_check" CHECK ("kind" IN ('created','status','priority','assigned','comment','official'));
ALTER TABLE "polls" ADD CONSTRAINT "polls_status_check" CHECK ("status" IN ('draft','published','archived'));
ALTER TABLE "polls" ADD CONSTRAINT "polls_mode_check" CHECK ("mode" IN ('anonymous','identified'));
ALTER TABLE "polls" ADD CONSTRAINT "polls_dates_check" CHECK ("closes_at" > "opens_at");
ALTER TABLE "complaints" DROP CONSTRAINT "complaints_entity_type_check";
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_entity_type_check" CHECK ("entity_type" IN ('announcement','organization','news','event','job','lost_found'));

-- RBAC (mirrors apps/api/src/rbac/permissions.ts)
INSERT INTO "permissions" ("code", "description") VALUES
  ('moderation.community', 'Модерация вакансий и раздела «Потеряно и найдено»'),
  ('issues.manage', 'Работа с обращениями жителей: статусы, приоритет, ответственный, комментарии'),
  ('issues.respond', 'Публичный ответ платформы по обращению'),
  ('polls.manage', 'Создание и проведение опросов'),
  ('business.review', 'Рассмотрение заявок бизнеса и изменений карточек владельцами');
INSERT INTO "role_permissions" ("role_code", "permission_code") VALUES
  ('super_admin', 'moderation.community'),
  ('super_admin', 'issues.manage'),
  ('super_admin', 'issues.respond'),
  ('super_admin', 'polls.manage'),
  ('super_admin', 'business.review'),
  ('admin', 'moderation.community'),
  ('admin', 'issues.manage'),
  ('admin', 'issues.respond'),
  ('admin', 'polls.manage'),
  ('admin', 'business.review'),
  ('moderator', 'moderation.community'),
  ('moderator', 'issues.manage'),
  ('editor', 'polls.manage'),
  ('support', 'issues.manage');
