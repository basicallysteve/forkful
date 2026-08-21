ALTER TABLE "users" ADD COLUMN "calorie_goal" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "protein_goal" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "carbs_goal" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "fat_goal" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "fiber_goal" numeric(10, 2);