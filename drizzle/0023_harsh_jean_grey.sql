ALTER TABLE "pantry_items" ADD COLUMN "recipe_id" integer;--> statement-breakpoint
ALTER TABLE "pantry_items" ADD COLUMN "recipe_name_snapshot" varchar(255);--> statement-breakpoint
ALTER TABLE "pantry_items" ADD CONSTRAINT "pantry_items_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;