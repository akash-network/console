SET lock_timeout = '3s';--> statement-breakpoint
CREATE INDEX "activities_pending_type_created_at_idx" ON "activities" USING btree ("type","created_at") WHERE "activities"."status" = 'pending';--> statement-breakpoint
RESET lock_timeout;