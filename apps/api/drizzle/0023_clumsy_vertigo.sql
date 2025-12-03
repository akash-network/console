ALTER TABLE "user_wallets" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_methods_user_id_is_default_unique" ON "payment_methods" USING btree ("user_id","is_default") WHERE "payment_methods"."is_default" = true;--> statement-breakpoint
ALTER TABLE "wallet_settings" DROP COLUMN IF EXISTS "auto_reload_threshold";--> statement-breakpoint
ALTER TABLE "wallet_settings" DROP COLUMN IF EXISTS "auto_reload_amount";