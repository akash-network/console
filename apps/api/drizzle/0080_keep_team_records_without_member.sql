SET lock_timeout = '3s';--> statement-breakpoint
ALTER TABLE "payment_methods" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "stripe_transactions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "wallet_settings" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "deployment_settings" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
RESET lock_timeout;
