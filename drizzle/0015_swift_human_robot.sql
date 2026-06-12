CREATE TYPE "public"."account_closure_action" AS ENUM('deactivated', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."pantry_expiration_frequency" AS ENUM('never', 'daily', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."recipe_suggestion_frequency" AS ENUM('never', 'weekly', 'monthly');--> statement-breakpoint
CREATE TABLE "account_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" "account_closure_action" NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "marketing_email_opt_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "recipe_suggestion_frequency" "recipe_suggestion_frequency" DEFAULT 'weekly' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pantry_expiration_frequency" "pantry_expiration_frequency" DEFAULT 'weekly' NOT NULL;