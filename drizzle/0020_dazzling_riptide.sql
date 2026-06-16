ALTER TABLE "recipes" DROP CONSTRAINT "recipes_slug_unique";--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "short_id" varchar(8);--> statement-breakpoint
UPDATE "recipes" SET "short_id" = translate(encode(gen_random_bytes(6), 'base64'), '+/=', '-_') WHERE "short_id" IS NULL;--> statement-breakpoint
ALTER TABLE "recipes" ALTER COLUMN "short_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_short_id_unique" UNIQUE("short_id");
