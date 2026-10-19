-- PHASE 5: complaints + admin platform permissions.

CREATE TABLE "complaints" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "reporter_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolution_note" TEXT,
    "resolved_by_id" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "complaints_entity_type_check" CHECK ("entity_type" IN ('announcement', 'organization', 'news', 'event')),
    CONSTRAINT "complaints_reason_check" CHECK ("reason" IN ('spam', 'fraud', 'offensive', 'wrong_info', 'other')),
    CONSTRAINT "complaints_status_check" CHECK ("status" IN ('open', 'resolved', 'dismissed')),
    CONSTRAINT "complaints_resolution_check" CHECK ("status" = 'open' OR ("resolved_at" IS NOT NULL AND "resolution_note" IS NOT NULL))
);

CREATE INDEX "complaints_status_created_at_idx" ON "complaints"("status", "created_at");
CREATE INDEX "complaints_entity_type_entity_id_idx" ON "complaints"("entity_type", "entity_id");
CREATE INDEX "complaints_reporter_id_idx" ON "complaints"("reporter_id");
-- One open complaint per reporter and entity.
CREATE UNIQUE INDEX "complaints_open_unique" ON "complaints"("reporter_id", "entity_type", "entity_id") WHERE "status" = 'open';

-- RBAC: PHASE 5 permissions (mirrors src/rbac/permissions.ts)
INSERT INTO "permissions" ("code", "description") VALUES
  ('complaints.manage', 'Рассмотрение жалоб на контент'),
  ('organizations.verify', 'Подтверждение проверки данных организаций'),
  ('settings.manage', 'Изменение настроек платформы (порог доверия модерации)');
INSERT INTO "role_permissions" ("role_code", "permission_code") VALUES
  ('super_admin', 'complaints.manage'),
  ('super_admin', 'organizations.verify'),
  ('super_admin', 'settings.manage'),
  ('admin', 'complaints.manage'),
  ('admin', 'organizations.verify'),
  ('admin', 'settings.manage'),
  ('moderator', 'complaints.manage'),
  ('support', 'complaints.manage');
