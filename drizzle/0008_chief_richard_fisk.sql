DO $$ BEGIN
 CREATE TYPE "public"."food_source" AS ENUM('manual', 'open_food_facts');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saved_recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"recipe_id" integer NOT NULL,
	"date_saved" timestamp DEFAULT now() NOT NULL,
	"date_deleted" timestamp
);
--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "saturated_fat" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "sugar" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "sodium" numeric(10, 1);--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "barcode" varchar(50);--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "source" "food_source" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "pantry_items" ADD COLUMN "user_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "user_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saved_recipes" ADD CONSTRAINT "saved_recipes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saved_recipes" ADD CONSTRAINT "saved_recipes_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pantry_items" ADD CONSTRAINT "pantry_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
