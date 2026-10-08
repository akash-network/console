SET lock_timeout = '3s';--> statement-breakpoint
ALTER TABLE "stripe_transactions" ADD COLUMN "dispute_lost_at" timestamp with time zone;--> statement-breakpoint
RESET lock_timeout;
