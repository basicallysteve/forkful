ALTER TABLE "users" ADD COLUMN "cuisine_preferences" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "dietary_restrictions" jsonb DEFAULT '[]'::jsonb;