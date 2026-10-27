-- PHASE 8a: full-text search for community and social modules (same approach as core content).
ALTER TABLE "jobs" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('russian', coalesce("title", '')), 'A') || setweight(to_tsvector('russian', coalesce("employer", '')), 'B') || setweight(to_tsvector('russian', coalesce("description", '')), 'C')) STORED;
CREATE INDEX "jobs_search_idx" ON "jobs" USING GIN ("search");

ALTER TABLE "lost_found" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('russian', coalesce("title", '')), 'A') || setweight(to_tsvector('russian', coalesce("description", '')), 'C')) STORED;
CREATE INDEX "lost_found_search_idx" ON "lost_found" USING GIN ("search");

ALTER TABLE "groups" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('russian', coalesce("name", '')), 'A') || setweight(to_tsvector('russian', coalesce("description", '')), 'C')) STORED;
CREATE INDEX "groups_search_idx" ON "groups" USING GIN ("search");

ALTER TABLE "posts" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('russian', coalesce("body", '')), 'B')) STORED;
CREATE INDEX "posts_search_idx" ON "posts" USING GIN ("search");

CREATE INDEX "jobs_title_trgm_idx" ON "jobs" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "lost_found_title_trgm_idx" ON "lost_found" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "groups_name_trgm_idx" ON "groups" USING GIN ("name" gin_trgm_ops);
