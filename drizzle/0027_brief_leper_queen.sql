ALTER TABLE "shopping_list_items" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ALTER COLUMN "status" SET DEFAULT 'to_buy'::text;--> statement-breakpoint
UPDATE "shopping_list_items" SET "status" = 'bought' WHERE "status" IN ('in_cart', 'purchased');--> statement-breakpoint
DROP TYPE "public"."shopping_list_item_status";--> statement-breakpoint
CREATE TYPE "public"."shopping_list_item_status" AS ENUM('to_buy', 'bought', 'unavailable');--> statement-breakpoint
ALTER TABLE "shopping_list_items" ALTER COLUMN "status" SET DEFAULT 'to_buy'::"public"."shopping_list_item_status";--> statement-breakpoint
ALTER TABLE "shopping_list_items" ALTER COLUMN "status" SET DATA TYPE "public"."shopping_list_item_status" USING "status"::"public"."shopping_list_item_status";