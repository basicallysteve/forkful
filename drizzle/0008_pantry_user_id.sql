-- Step 1: add as NULLable to avoid failing on any existing rows
ALTER TABLE "pantry_items" ADD COLUMN "user_id" integer REFERENCES "users"("id") ON DELETE CASCADE;

-- Step 2: remove any orphaned rows that cannot be assigned to a user
DELETE FROM "pantry_items" WHERE "user_id" IS NULL;

-- Step 3: enforce NOT NULL now that all rows have a value
ALTER TABLE "pantry_items" ALTER COLUMN "user_id" SET NOT NULL;
