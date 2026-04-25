CREATE TABLE IF NOT EXISTS "pantry_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "food_id" integer NOT NULL,
  "expiration_date" timestamp,
  "original_size_amount" numeric(10,2) NOT NULL,
  "original_size_unit" varchar(50),
  "current_size_amount" numeric(10,2) NOT NULL,
  "current_size_unit" varchar(50),
  "added_date" timestamp DEFAULT now() NOT NULL,
  "frozen_date" timestamp,
  "date_deleted" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "pantry_items" ADD CONSTRAINT "pantry_items_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
