-- PHASE 12: territory hierarchy with the single current locality.
CREATE TABLE "territories" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "parent_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "territories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "territories_kind_check" CHECK ("kind" IN ('region', 'district', 'locality')),
    CONSTRAINT "territories_default_active_check" CHECK (NOT "is_default" OR "is_active")
);
CREATE UNIQUE INDEX "territories_slug_key" ON "territories"("slug");
CREATE INDEX "territories_parent_id_idx" ON "territories"("parent_id");
CREATE UNIQUE INDEX "territories_single_default" ON "territories"("is_default") WHERE "is_default";
ALTER TABLE "territories" ADD CONSTRAINT "territories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "territories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "territories" ("slug", "name", "kind") VALUES ('novosibirsk-oblast', 'Новосибирская область', 'region');
INSERT INTO "territories" ("slug", "name", "kind", "parent_id")
  SELECT 'moshkovsky-rayon', 'Мошковский район', 'district', "id" FROM "territories" WHERE "slug" = 'novosibirsk-oblast';
INSERT INTO "territories" ("slug", "name", "kind", "parent_id", "is_active", "is_default")
  SELECT 'oktyabrsky-svetly', 'посёлок Октябрьский и жилой район Светлый', 'locality', "id", true, true
  FROM "territories" WHERE "slug" = 'moshkovsky-rayon';
