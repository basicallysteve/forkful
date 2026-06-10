CREATE TABLE "recipe_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"position" integer NOT NULL,
	"title" varchar(255),
	"content" text DEFAULT '' NOT NULL,
	"date_added" timestamp DEFAULT now(),
	"date_deleted" timestamp
);
--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "prep_time" integer;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "cook_time" integer;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "total_time" integer;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "cuisine_type" varchar(100);--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "dietary_tags" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;