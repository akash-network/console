-- Add BME running total columns to block table
ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "totalUaktBurnedForUact" double precision;
ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "totalUactMinted" double precision;
ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "totalUactBurnedForUakt" double precision;
ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "totalUaktReminted" double precision;
ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "vaultUakt" double precision;
ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "outstandingUact" double precision;

-- Create bme_raw_event table
CREATE TABLE IF NOT EXISTS "bme_raw_event" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "height" integer NOT NULL,
  "index" integer NOT NULL,
  "type" varchar(255) NOT NULL,
  "data" jsonb NOT NULL,
  "is_processed" boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS "bme_raw_event_height_index" ON "bme_raw_event" ("height", "index");
CREATE INDEX IF NOT EXISTS "bme_raw_event_height_is_processed" ON "bme_raw_event" ("height", "is_processed");
ALTER TABLE "bme_raw_event" ADD CONSTRAINT "bme_raw_event_height_fkey" FOREIGN KEY ("height") REFERENCES "block" ("height");

-- Create bme_ledger_record table
CREATE TABLE IF NOT EXISTS "bme_ledger_record" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "height" integer NOT NULL,
  "sequence" integer,
  "burned_from" varchar(255) NOT NULL,
  "minted_to" varchar(255) NOT NULL,
  "burned_denom" varchar(255),
  "burned_amount" numeric(30, 0) NOT NULL,
  "burned_price" numeric(20, 10),
  "minted_denom" varchar(255),
  "minted_amount" numeric(30, 0) NOT NULL,
  "minted_price" numeric(20, 10),
  "remint_credit_issued_amount" numeric(30, 0),
  "remint_credit_accrued_amount" numeric(30, 0)
);

CREATE INDEX IF NOT EXISTS "bme_ledger_record_height" ON "bme_ledger_record" ("height");
CREATE INDEX IF NOT EXISTS "bme_ledger_record_burned_denom_height" ON "bme_ledger_record" ("burned_denom", "height");
CREATE INDEX IF NOT EXISTS "bme_ledger_record_minted_denom_height" ON "bme_ledger_record" ("minted_denom", "height");
ALTER TABLE "bme_ledger_record" ADD CONSTRAINT "bme_ledger_record_height_fkey" FOREIGN KEY ("height") REFERENCES "block" ("height");

-- Create bme_status_change table
CREATE TABLE IF NOT EXISTS "bme_status_change" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "height" integer NOT NULL,
  "previous_status" varchar(255) NOT NULL,
  "new_status" varchar(255) NOT NULL,
  "collateral_ratio" numeric(20, 10) NOT NULL
);

CREATE INDEX IF NOT EXISTS "bme_status_change_height" ON "bme_status_change" ("height");
ALTER TABLE "bme_status_change" ADD CONSTRAINT "bme_status_change_height_fkey" FOREIGN KEY ("height") REFERENCES "block" ("height");
