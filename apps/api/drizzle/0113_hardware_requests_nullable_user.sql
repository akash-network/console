SET lock_timeout = '3s';--> statement-breakpoint
ALTER TABLE "hardware_requests" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "hardware_requests_unclaimed_contact_email_idx" ON "hardware_requests" USING btree (lower("contact_email")) WHERE "hardware_requests"."user_id" IS NULL;--> statement-breakpoint
RESET lock_timeout;
