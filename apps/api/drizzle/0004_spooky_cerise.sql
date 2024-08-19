ALTER TABLE "user_wallets" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "user_wallets" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "userSetting" ADD COLUMN "created_at" timestamp DEFAULT now();