-- Idempotent: safe to re-run if any statements were already applied.
--> statement-breakpoint
DO $$ BEGIN
  ALTER TYPE "public"."food_source" ADD VALUE 'usda';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."product_source" AS ENUM('manual', 'open_food_facts', 'usda_branded');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255),
	"barcode" varchar(50),
	"external_id" varchar(100),
	"parent_food_id" integer,
	"calories" integer NOT NULL,
	"protein" numeric(10, 2) NOT NULL DEFAULT '0',
	"carbs" numeric(10, 2) NOT NULL DEFAULT '0',
	"fat" numeric(10, 2) NOT NULL DEFAULT '0',
	"fiber" numeric(10, 2) NOT NULL DEFAULT '0',
	"serving_size" numeric(10, 2) NOT NULL DEFAULT '1',
	"serving_unit" varchar(50),
	"measurements" jsonb DEFAULT '[]'::jsonb,
	"saturated_fat" numeric(10, 2),
	"sugar" numeric(10, 2),
	"sodium" numeric(10, 1),
	"source" "product_source" NOT NULL DEFAULT 'manual',
	"date_added" timestamp DEFAULT now(),
	"date_updated" timestamp,
	"date_deleted" timestamp,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "products" ADD CONSTRAINT "products_parent_food_id_foods_id_fk"
    FOREIGN KEY ("parent_food_id") REFERENCES "public"."foods"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "foods" ADD COLUMN "external_id" varchar(100);
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "foods" DROP COLUMN "barcode";
EXCEPTION
  WHEN undefined_column THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "pantry_items" ADD COLUMN "source_type" varchar(20) NOT NULL DEFAULT 'food';
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "pantry_items" ADD COLUMN "product_id" integer;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "pantry_items" ADD CONSTRAINT "pantry_items_product_id_products_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "pantry_items" ALTER COLUMN "food_id" DROP NOT NULL;
