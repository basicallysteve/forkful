ALTER TABLE "pantry_items" ADD COLUMN "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE;
