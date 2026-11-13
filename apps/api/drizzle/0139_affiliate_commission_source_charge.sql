ALTER TABLE "stripe_transactions" ADD COLUMN "source_stripe_charge_id" varchar(255);--> statement-breakpoint
CREATE INDEX "stripe_transactions_source_stripe_charge_id_idx" ON "stripe_transactions" USING btree ("source_stripe_charge_id") WHERE "stripe_transactions"."source_stripe_charge_id" IS NOT NULL;--> statement-breakpoint
UPDATE "stripe_transactions" AS "commission" SET "source_stripe_charge_id" = "payment"."stripe_charge_id" FROM "stripe_transactions" AS "payment" WHERE "commission"."source_transaction_id" = "payment"."id";
