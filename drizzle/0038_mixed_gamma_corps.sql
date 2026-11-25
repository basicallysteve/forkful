CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(40) NOT NULL,
	"user_id" integer,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"status" varchar(10) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp,
	"sent_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_status_next_attempt_idx" ON "events" USING btree ("status","next_attempt_at");