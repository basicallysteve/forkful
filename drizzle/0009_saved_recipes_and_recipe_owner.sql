-- Backfill: make all existing non-deleted recipes public so they remain visible after the visibility filter is applied
UPDATE "recipes" SET "is_public" = 1 WHERE "date_deleted" IS NULL;
--> statement-breakpoint
-- Track which user owns each recipe
ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "user_id" integer;
DO $$ BEGIN
 ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Saved recipe bookmarks (one active bookmark per user/recipe pair enforced by unique constraint)
CREATE TABLE IF NOT EXISTS "saved_recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"recipe_id" integer NOT NULL,
	"date_saved" timestamp DEFAULT now() NOT NULL,
	"date_deleted" timestamp,
	CONSTRAINT "saved_recipes_user_recipe_unique" UNIQUE("user_id","recipe_id")
);
--> statement-breakpoint
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
