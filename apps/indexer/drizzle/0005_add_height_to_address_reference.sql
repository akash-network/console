-- Add height column to addressReference for query optimization
ALTER TABLE "addressReference" ADD COLUMN IF NOT EXISTS "height" integer;--> statement-breakpoint

-- Backfill height from transaction table
UPDATE "addressReference" ar
SET height = t.height
FROM "transaction" t
WHERE ar."transactionId" = t.id
AND ar.height IS NULL;--> statement-breakpoint

-- Create index for optimized address transaction queries
-- https://github.com/drizzle-team/drizzle-orm/issues/860#issuecomment-2544465387
COMMIT;--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "address_reference_address_height_desc" ON "addressReference" USING btree ("address" ASC NULLS LAST, "height" DESC NULLS LAST);
