CREATE INDEX "review_likes_review_id_idx" ON "review_likes" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "review_reports_review_id_idx" ON "review_reports" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "review_reports_date_added_idx" ON "review_reports" USING btree ("date_added");