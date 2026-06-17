CREATE TYPE "public"."review_report_reason" AS ENUM('spam', 'offensive_language', 'harassment', 'off_topic');--> statement-breakpoint
CREATE TABLE "review_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"review_id" integer NOT NULL,
	"date_added" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "review_likes_user_review_unique" UNIQUE("user_id","review_id")
);
--> statement-breakpoint
CREATE TABLE "review_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"review_id" integer NOT NULL,
	"reason" "review_report_reason" NOT NULL,
	"comment" text,
	"date_added" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "review_reports_user_review_unique" UNIQUE("user_id","review_id")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"recipe_id" integer NOT NULL,
	"rating" integer NOT NULL,
	"body" text,
	"date_added" timestamp DEFAULT now() NOT NULL,
	"date_updated" timestamp,
	CONSTRAINT "reviews_user_recipe_unique" UNIQUE("user_id","recipe_id")
);
--> statement-breakpoint
ALTER TABLE "review_likes" ADD CONSTRAINT "review_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_likes" ADD CONSTRAINT "review_likes_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reviews_recipe_id_idx" ON "reviews" USING btree ("recipe_id");