-- PHASE 7a: groups, feed posts, comments, reactions, favorites

CREATE TABLE "groups" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "rules" TEXT NOT NULL DEFAULT '',
    "topic" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'open',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "moderation_note" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "groups_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "groups_visibility_check" CHECK ("visibility" IN ('open','closed')),
    CONSTRAINT "groups_status_check" CHECK ("status" IN ('pending','active','rejected','archived'))
);
CREATE UNIQUE INDEX "groups_slug_key" ON "groups"("slug");
CREATE INDEX "groups_status_created_at_idx" ON "groups"("status", "created_at");

CREATE TABLE "group_members" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "group_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "group_members_role_check" CHECK ("role" IN ('owner','moderator','member')),
    CONSTRAINT "group_members_status_check" CHECK ("status" IN ('active','pending','banned'))
);
CREATE UNIQUE INDEX "group_members_group_id_user_id_key" ON "group_members"("group_id", "user_id");
CREATE INDEX "group_members_user_id_idx" ON "group_members"("user_id");

CREATE TABLE "posts" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "group_id" UUID,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "image_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "moderation_note" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(6),
    "edited_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "posts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "posts_status_check" CHECK ("status" IN ('pending','published','rejected','removed','deleted'))
);
CREATE INDEX "posts_status_published_at_idx" ON "posts"("status", "published_at");
CREATE INDEX "posts_group_id_status_published_at_idx" ON "posts"("group_id", "status", "published_at");
CREATE INDEX "posts_author_id_idx" ON "posts"("author_id");

CREATE TABLE "comments" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "post_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "parent_id" UUID,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "moderation_note" TEXT,
    "edited_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "comments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "comments_status_check" CHECK ("status" IN ('published','removed','deleted'))
);
CREATE INDEX "comments_post_id_created_at_idx" ON "comments"("post_id", "created_at");
CREATE INDEX "comments_author_id_created_at_idx" ON "comments"("author_id", "created_at");

CREATE TABLE "post_reactions" (
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "post_reactions_pkey" PRIMARY KEY ("post_id","user_id")
);

CREATE TABLE "favorites" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "favorites_entity_type_check" CHECK ("entity_type" IN ('announcement','news','event','organization','job','lost_found','post'))
);
CREATE UNIQUE INDEX "favorites_user_id_entity_type_entity_id_key" ON "favorites"("user_id", "entity_type", "entity_id");
CREATE INDEX "favorites_user_id_created_at_idx" ON "favorites"("user_id", "created_at");

ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "posts" ADD CONSTRAINT "posts_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "complaints" DROP CONSTRAINT "complaints_entity_type_check";
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_entity_type_check" CHECK ("entity_type" IN ('announcement','organization','news','event','job','lost_found','group','post','comment'));
