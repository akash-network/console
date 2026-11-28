SET lock_timeout = '3s';--> statement-breakpoint
CREATE INDEX "organization_activities_organization_id_dseq_created_at_id_idx" ON "organization_activities" USING btree ("organization_id",("payload" ->> 'dseq'),"created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
RESET lock_timeout;
