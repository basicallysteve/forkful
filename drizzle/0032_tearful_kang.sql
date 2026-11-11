CREATE TYPE "public"."food_log_source_type" AS ENUM('food', 'product', 'prepared_meal');--> statement-breakpoint
CREATE TABLE "food_log_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"source_type" "food_log_source_type" DEFAULT 'food' NOT NULL,
	"food_id" integer,
	"amount" numeric(10, 2) NOT NULL,
	"unit" varchar(50),
	"calories" numeric(10, 2) DEFAULT '0' NOT NULL,
	"protein" numeric(10, 2) DEFAULT '0' NOT NULL,
	"carbs" numeric(10, 2) DEFAULT '0' NOT NULL,
	"fat" numeric(10, 2) DEFAULT '0' NOT NULL,
	"fiber" numeric(10, 2) DEFAULT '0' NOT NULL,
	"log_date" date NOT NULL,
	"date_added" timestamp DEFAULT now() NOT NULL,
	"date_deleted" timestamp
);
--> statement-breakpoint
ALTER TABLE "food_log_entries" ADD CONSTRAINT "food_log_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_log_entries" ADD CONSTRAINT "food_log_entries_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "food_log_entries_user_log_date_idx" ON "food_log_entries" USING btree ("user_id","log_date","date_deleted");