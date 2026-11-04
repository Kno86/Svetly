-- Profile photo: a public media asset owned by the user; removing the asset clears the avatar.
ALTER TABLE "users" ADD COLUMN "avatar_id" UUID;
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_id_fkey" FOREIGN KEY ("avatar_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
