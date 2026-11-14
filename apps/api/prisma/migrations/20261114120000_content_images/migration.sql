-- Photos for every public content type (the first image is the preview).
ALTER TABLE "organizations" ADD COLUMN "image_ids" UUID[] DEFAULT ARRAY[]::UUID[];
ALTER TABLE "events" ADD COLUMN "image_ids" UUID[] DEFAULT ARRAY[]::UUID[];
ALTER TABLE "directory_entries" ADD COLUMN "image_ids" UUID[] DEFAULT ARRAY[]::UUID[];
ALTER TABLE "jobs" ADD COLUMN "image_ids" UUID[] DEFAULT ARRAY[]::UUID[];
ALTER TABLE "polls" ADD COLUMN "image_ids" UUID[] DEFAULT ARRAY[]::UUID[];
ALTER TABLE "groups" ADD COLUMN "image_ids" UUID[] DEFAULT ARRAY[]::UUID[];
