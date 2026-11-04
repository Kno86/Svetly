-- Premoderated resident reviews of organizations (one per resident and organization).
CREATE TABLE "organization_reviews" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "moderation_note" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "organization_reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "organization_reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
    CONSTRAINT "organization_reviews_body_check" CHECK (char_length("body") BETWEEN 20 AND 2000),
    CONSTRAINT "organization_reviews_status_check" CHECK ("status" IN ('pending', 'published', 'rejected'))
);
CREATE UNIQUE INDEX "organization_reviews_organization_id_author_id_key" ON "organization_reviews"("organization_id", "author_id");
CREATE INDEX "organization_reviews_status_created_at_idx" ON "organization_reviews"("status", "created_at");
ALTER TABLE "organization_reviews" ADD CONSTRAINT "organization_reviews_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_reviews" ADD CONSTRAINT "organization_reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
