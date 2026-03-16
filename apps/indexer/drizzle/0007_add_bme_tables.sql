-- Add BME running total columns to block table
ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "totalAktBurnedForAct" double precision;
ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "totalActMinted" double precision;
ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "totalActBurnedForAkt" double precision;
ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "totalAktReminted" double precision;
ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "totalRemintCreditIssued" double precision;
ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "totalRemintCreditAccrued" double precision;
ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "vaultAkt" double precision;
ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "outstandingAct" double precision;

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

-- Create bme_ledger_record table
CREATE TABLE IF NOT EXISTS "bme_ledger_record" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "height" integer NOT NULL,
  "sequence" integer,
  "burned_from" varchar(255) NOT NULL,
  "minted_to" varchar(255) NOT NULL,
  "burner" varchar(255),
  "minter" varchar(255),
  "burned_denom" varchar(255) NOT NULL,
  "burned_amount" numeric(30, 0) NOT NULL,
  "burned_price" numeric(20, 10),
  "minted_denom" varchar(255) NOT NULL,
  "minted_amount" numeric(30, 0) NOT NULL,
  "minted_price" numeric(20, 10),
  "remint_credit_issued_amount" numeric(30, 0),
  "remint_credit_accrued_amount" numeric(30, 0)
);

CREATE INDEX IF NOT EXISTS "bme_ledger_record_height" ON "bme_ledger_record" ("height");
CREATE INDEX IF NOT EXISTS "bme_ledger_record_burned_denom_height" ON "bme_ledger_record" ("burned_denom", "height");
CREATE INDEX IF NOT EXISTS "bme_ledger_record_minted_denom_height" ON "bme_ledger_record" ("minted_denom", "height");

-- Create bme_status_change table
CREATE TABLE IF NOT EXISTS "bme_status_change" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "height" integer NOT NULL,
  "previous_status" varchar(255) NOT NULL,
  "new_status" varchar(255) NOT NULL,
  "collateral_ratio" numeric(20, 10) NOT NULL
);

CREATE INDEX IF NOT EXISTS "bme_status_change_height" ON "bme_status_change" ("height");
