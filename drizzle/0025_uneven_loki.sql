CREATE TYPE "public"."shopping_list_item_source_type" AS ENUM('food', 'product', 'freeform');--> statement-breakpoint
CREATE TYPE "public"."shopping_list_item_status" AS ENUM('to_buy', 'in_cart', 'purchased');--> statement-breakpoint
CREATE TYPE "public"."shopping_list_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TABLE "shopping_list_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"shopping_list_id" integer NOT NULL,
	"source_type" "shopping_list_item_source_type" DEFAULT 'food' NOT NULL,
	"food_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"unit" varchar(50) NOT NULL,
	"status" "shopping_list_item_status" DEFAULT 'to_buy' NOT NULL,
	"date_added" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"status" "shopping_list_status" DEFAULT 'active' NOT NULL,
	"date_added" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_shopping_list_id_shopping_lists_id_fk" FOREIGN KEY ("shopping_list_id") REFERENCES "public"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shopping_list_items_shopping_list_id_idx" ON "shopping_list_items" USING btree ("shopping_list_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shopping_lists_user_active_unique" ON "shopping_lists" USING btree ("user_id") WHERE "shopping_lists"."status" = 'active';