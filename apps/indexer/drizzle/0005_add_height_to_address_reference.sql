-- Add height column to addressReference for query optimization
ALTER TABLE "addressReference" ADD COLUMN IF NOT EXISTS "height" integer;--> statement-breakpoint

-- Create index for optimized address transaction queries
-- https://github.com/drizzle-team/drizzle-orm/issues/860#issuecomment-2544465387
COMMIT;--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "address_reference_address_height_desc" ON "addressReference" USING btree ("address" ASC NULLS LAST, "height" DESC NULLS LAST);

-- NOTE: Backfill is done separately via scripts/backfill-address-reference-height.sql
-- Run after deployment: psql $DATABASE_URL -f scripts/backfill-address-reference-height.sql
