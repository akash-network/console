SET lock_timeout = '3s';--> statement-breakpoint
ALTER TABLE "hardware_requests" ADD COLUMN "first_reply_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hardware_requests" ADD COLUMN "first_offer_due_at" timestamp with time zone;--> statement-breakpoint
RESET lock_timeout;
