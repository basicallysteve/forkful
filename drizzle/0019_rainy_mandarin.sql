CREATE TYPE "public"."product_source" AS ENUM('manual', 'open_food_facts', 'usda_branded');--> statement-breakpoint
ALTER TYPE "public"."food_source" ADD VALUE 'usda';--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255),
	"barcode" varchar(50),
	"external_id" varchar(100),
	"parent_food_id" integer,
	"calories" integer NOT NULL,
	"protein" numeric(10, 2) DEFAULT '0' NOT NULL,
	"carbs" numeric(10, 2) DEFAULT '0' NOT NULL,
	"fat" numeric(10, 2) DEFAULT '0' NOT NULL,
	"fiber" numeric(10, 2) DEFAULT '0' NOT NULL,
	"serving_size" numeric(10, 2) DEFAULT '1' NOT NULL,
	"serving_unit" varchar(50),
	"measurements" jsonb DEFAULT '[]'::jsonb,
	"density" numeric(10, 4),
	"saturated_fat" numeric(10, 2),
	"sugar" numeric(10, 2),
	"sodium" numeric(10, 1),
	"source" "product_source" DEFAULT 'manual' NOT NULL,
	"date_added" timestamp DEFAULT now(),
	"date_updated" timestamp,
	"date_deleted" timestamp,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "foods" RENAME COLUMN "barcode" TO "external_id";--> statement-breakpoint
ALTER TABLE "account_feedback" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pantry_items" ALTER COLUMN "food_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "density" numeric(10, 4);--> statement-breakpoint
ALTER TABLE "pantry_items" ADD COLUMN "source_type" varchar(20) DEFAULT 'food' NOT NULL;--> statement-breakpoint
ALTER TABLE "pantry_items" ADD COLUMN "product_id" integer;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_parent_food_id_foods_id_fk" FOREIGN KEY ("parent_food_id") REFERENCES "public"."foods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantry_items" ADD CONSTRAINT "pantry_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;