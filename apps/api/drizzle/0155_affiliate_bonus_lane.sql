SET lock_timeout = '3s';--> statement-breakpoint
DROP INDEX "stripe_transactions_source_transaction_id_unique";--> statement-breakpoint
ALTER TABLE "stripe_transactions" ADD COLUMN "affiliate_bonus" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "referrals" ADD COLUMN "first_commission_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_transactions_source_transaction_id_unique" ON "stripe_transactions" USING btree ("source_transaction_id","affiliate_bonus") WHERE "stripe_transactions"."source_transaction_id" IS NOT NULL AND "stripe_transactions"."status" <> 'refunded';--> statement-breakpoint
RESET lock_timeout;
