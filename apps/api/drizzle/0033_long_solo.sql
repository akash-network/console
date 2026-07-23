ALTER TABLE "user_wallets" ADD COLUMN "activated_at" timestamp with time zone;--> statement-breakpoint
UPDATE "user_wallets" SET "activated_at" = "created_at" WHERE "address" IS NOT NULL;