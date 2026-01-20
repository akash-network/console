-- https://github.com/drizzle-team/drizzle-orm/issues/860#issuecomment-2544465387
COMMIT;--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "transaction_height_desc_index_desc" ON "transaction" USING btree ("height" DESC NULLS LAST,"index" DESC NULLS LAST);
