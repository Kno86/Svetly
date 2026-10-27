-- PHASE 8b: notification categories, opt-outs and de-duplication; privacy-minimal analytics events.
ALTER TABLE "notifications" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'system';
ALTER TABLE "notifications" ADD COLUMN "dedupe_key" TEXT;
UPDATE "notifications" SET "category" = CASE
  WHEN "type" IN ('post_comment', 'comment_reply') THEN 'comments'
  WHEN "type" LIKE 'group_%' THEN 'groups'
  WHEN "type" IN ('post_approved', 'post_rejected', 'post_removed', 'comment_removed') THEN 'moderation'
  ELSE 'system' END;
CREATE UNIQUE INDEX "notifications_user_id_dedupe_key_key" ON "notifications"("user_id", "dedupe_key");
CREATE INDEX "notifications_user_id_category_created_at_idx" ON "notifications"("user_id", "category", "created_at");

CREATE TABLE "notification_preferences" (
    "user_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id", "category")
);
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "module" TEXT,
    "path" TEXT,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "actor" TEXT,
    "source" TEXT,
    "medium" TEXT,
    "campaign" TEXT,
    "referrer_host" TEXT,
    "query" TEXT,
    "results" INTEGER,
    "meta" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "analytics_events_occurred_at_idx" ON "analytics_events"("occurred_at");
CREATE INDEX "analytics_events_name_occurred_at_idx" ON "analytics_events"("name", "occurred_at");

INSERT INTO "permissions" ("code", "description") VALUES
  ('analytics.read', 'Просмотр агрегированной аналитики');
INSERT INTO "role_permissions" ("role_code", "permission_code") VALUES
  ('super_admin', 'analytics.read'),
  ('admin', 'analytics.read');
