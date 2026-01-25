-- Backfill height column in addressReference table from transaction table
-- Run this after deploying migration 0005_add_height_to_address_reference.sql
-- Usage: psql $POSTGRES_URL -f scripts/backfill-address-reference-height.sql

DO $$
DECLARE
  batch_size INT := 100000;
  max_iterations INT := 1000;
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
        INNER JOIN "transaction" t2 ON ar2."transactionId" = t2.id
        WHERE ar2.height IS NULL
        LIMIT batch_size
      );

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    total_updated := total_updated + rows_updated;
    batch_count := batch_count + 1;

    RAISE NOTICE 'Batch %: Updated % rows (Total: %)', batch_count, rows_updated, total_updated;

    EXIT WHEN rows_updated = 0 OR batch_count >= max_iterations;
  END LOOP;

  IF batch_count >= max_iterations THEN
    RAISE NOTICE 'Backfill stopped at max iterations (%). Total rows updated: %', max_iterations, total_updated;
  ELSE
    RAISE NOTICE 'Backfill complete. Total rows updated: %', total_updated;
  END IF;
END $$;
