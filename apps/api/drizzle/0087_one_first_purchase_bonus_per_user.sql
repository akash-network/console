SET lock_timeout = '3s';--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_transactions_user_id_first_purchase_bonus_unique" ON "stripe_transactions" USING btree ("user_id") WHERE "stripe_transactions"."bonus_amount" > 0;--> statement-breakpoint
RESET lock_timeout;