ALTER TABLE "foods" ADD COLUMN IF NOT EXISTS "protein" numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "foods" ADD COLUMN IF NOT EXISTS "carbs" numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "foods" ADD COLUMN IF NOT EXISTS "fat" numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "foods" ADD COLUMN IF NOT EXISTS "fiber" numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "foods" ADD COLUMN IF NOT EXISTS "serving_size" numeric(10,2) NOT NULL DEFAULT 1;
ALTER TABLE "foods" ADD COLUMN IF NOT EXISTS "measurements" jsonb DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN IF NOT EXISTS "food_id" integer;
ALTER TABLE "ingredients" ADD COLUMN IF NOT EXISTS "serving_unit" varchar(50);
ALTER TABLE "ingredients" DROP COLUMN IF EXISTS "food_name";
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "ingredients" ALTER COLUMN "food_id" SET NOT NULL;
