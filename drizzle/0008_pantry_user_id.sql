-- Step 1: add as NULLable to avoid failing on any existing rows
ALTER TABLE "pantry_items" ADD COLUMN "user_id" integer REFERENCES "users"("id") ON DELETE CASCADE;

-- Step 2: remove rows that cannot be assigned to a user.
-- WARNING: because step 1 adds the column with no default, every pre-existing row
-- has user_id IS NULL at this point. This DELETE will wipe all existing pantry data.
-- Back up the table before running this migration on any environment with real data.
DELETE FROM "pantry_items" WHERE "user_id" IS NULL;

-- Step 3: enforce NOT NULL now that all rows have a value
ALTER TABLE "pantry_items" ALTER COLUMN "user_id" SET NOT NULL;
