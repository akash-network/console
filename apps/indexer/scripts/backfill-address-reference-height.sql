-- Backfill height column in addressReference table from transaction table
-- Run this after deploying migration 0005_add_height_to_address_reference.sql
-- Usage: psql $DATABASE_URL -f scripts/backfill-address-reference-height.sql

-- Batched update to avoid long-running transactions
-- Updates 100,000 rows at a time until no more rows need updating

-- Create the backfill procedure (COMMIT is only allowed in procedures, not DO blocks)
CREATE OR REPLACE PROCEDURE backfill_address_reference_height()
LANGUAGE plpgsql
AS $$
DECLARE
  batch_size INT := 100000;
  rows_updated INT;
  total_updated INT := 0;
  batch_count INT := 0;
BEGIN
  RAISE NOTICE 'Starting backfill of addressReference.height column...';

  LOOP
    UPDATE "addressReference" ar
    SET height = t.height
    FROM "transaction" t
    WHERE ar."transactionId" = t.id
      AND ar.height IS NULL
      AND ar.id IN (
        SELECT ar2.id
        FROM "addressReference" ar2
        WHERE ar2.height IS NULL
        LIMIT batch_size
      );

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    total_updated := total_updated + rows_updated;
    batch_count := batch_count + 1;

    RAISE NOTICE 'Batch %: Updated % rows (Total: %)', batch_count, rows_updated, total_updated;

    -- Commit each batch to release locks
    COMMIT;

    EXIT WHEN rows_updated = 0;
  END LOOP;

  RAISE NOTICE 'Backfill complete. Total rows updated: %', total_updated;
END $$;

-- Run the backfill
CALL backfill_address_reference_height();

-- Clean up the procedure after use (optional)
DROP PROCEDURE IF EXISTS backfill_address_reference_height();
