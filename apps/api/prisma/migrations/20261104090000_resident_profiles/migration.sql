-- Opt-in public resident profiles (hidden unless the resident enables them).
CREATE TABLE "resident_profiles" (
    "user_id" UUID NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "bio" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "resident_profiles_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "resident_profiles_bio_length" CHECK (char_length("bio") <= 500)
);
ALTER TABLE "resident_profiles" ADD CONSTRAINT "resident_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
