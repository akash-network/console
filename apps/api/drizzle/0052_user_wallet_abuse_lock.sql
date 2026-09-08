ALTER TABLE "user_wallets" ADD COLUMN "abuse_locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_wallets" ADD COLUMN "abuse_locked_reason" varchar(64);