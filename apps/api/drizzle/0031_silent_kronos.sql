DO $$ BEGIN
 CREATE TYPE "public"."user_wallet_status" AS ENUM('pending', 'ready', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "user_wallets" ADD COLUMN "status" "user_wallet_status" DEFAULT 'ready' NOT NULL;