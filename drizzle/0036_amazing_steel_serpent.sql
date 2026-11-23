CREATE TABLE "invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(254) NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"code_used_at" timestamp,
	"date_added" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invites_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "waitlist_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(254) NOT NULL,
	"name" varchar(100),
	"marketing_email_opt_in" boolean DEFAULT false NOT NULL,
	"date_added" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "invites_email_lower_unique" ON "invites" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_entries_email_lower_unique" ON "waitlist_entries" USING btree (lower("email"));