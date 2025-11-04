-- https://github.com/drizzle-team/drizzle-orm/issues/860#issuecomment-2544465387
COMMIT;--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "address_reference_address_transaction_id" ON "addressReference" USING btree ("address","transactionId");
