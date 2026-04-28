ALTER TABLE "ingredients" ALTER COLUMN "quantity" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "protein" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "carbs" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "fat" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "fiber" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "serving_size" numeric(10, 2) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "measurements" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "food_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "serving_unit" varchar(50);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "ingredients" DROP COLUMN IF EXISTS "food_name";