ALTER TABLE "foods" ADD COLUMN "date_added" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "date_updated" timestamp;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "date_deleted" timestamp;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "date_added" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "date_updated" timestamp;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "date_deleted" timestamp;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "date_deleted" timestamp;