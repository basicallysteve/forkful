ALTER TABLE "shopping_list_items" ALTER COLUMN "food_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ALTER COLUMN "unit" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD COLUMN "product_id" integer;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD COLUMN "name" varchar(255);--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;