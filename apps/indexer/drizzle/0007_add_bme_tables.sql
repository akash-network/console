-- Add BME running total columns to block table
ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "totalAktBurnedForAct" double precision;
ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "totalActMinted" double precision;
ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "totalActBurnedForAkt" double precision;
ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "totalAktReminted" double precision;
ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "totalVaultSeeded" double precision;
ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "totalRemintCreditIssued" double precision;
ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "totalRemintCreditAccrued" double precision;

-- Create bmeRawEvent table
CREATE TABLE IF NOT EXISTS "bmeRawEvent" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "height" integer NOT NULL,
  "index" integer NOT NULL,
  "type" varchar(255) NOT NULL,
  "data" jsonb NOT NULL,
  "isProcessed" boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS "bme_raw_event_height_index" ON "bmeRawEvent" ("height", "index");
CREATE INDEX IF NOT EXISTS "bme_raw_event_height_is_processed" ON "bmeRawEvent" ("height", "isProcessed");

-- Create bmeLedgerRecord table
CREATE TABLE IF NOT EXISTS "bmeLedgerRecord" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "height" integer NOT NULL,
  "burnedFrom" varchar(255) NOT NULL,
  "mintedTo" varchar(255) NOT NULL,
  "burnedDenom" varchar(255) NOT NULL,
  "burnedAmount" numeric(30, 0) NOT NULL,
  "burnedPrice" numeric(20, 10),
  "mintedDenom" varchar(255) NOT NULL,
  "mintedAmount" numeric(30, 0) NOT NULL,
  "mintedPrice" numeric(20, 10),
  "remintCreditIssuedAmount" numeric(30, 0),
  "remintCreditAccruedAmount" numeric(30, 0)
);

CREATE INDEX IF NOT EXISTS "bme_ledger_record_height" ON "bmeLedgerRecord" ("height");
CREATE INDEX IF NOT EXISTS "bme_ledger_record_burned_denom_height" ON "bmeLedgerRecord" ("burnedDenom", "height");
CREATE INDEX IF NOT EXISTS "bme_ledger_record_minted_denom_height" ON "bmeLedgerRecord" ("mintedDenom", "height");

-- Create bmeStatusChange table
CREATE TABLE IF NOT EXISTS "bmeStatusChange" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "height" integer NOT NULL,
  "previousStatus" varchar(255) NOT NULL,
  "newStatus" varchar(255) NOT NULL,
  "collateralRatio" numeric(20, 10) NOT NULL
);

CREATE INDEX IF NOT EXISTS "bme_status_change_height" ON "bmeStatusChange" ("height");
