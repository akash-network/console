CREATE TABLE IF NOT EXISTS "sink_totals_snapshot" (
  "height" integer PRIMARY KEY NOT NULL CONSTRAINT "sink_totals_snapshot_height_fkey" REFERENCES "block" ("height"),
  "pending_amount" numeric(30, 0) NOT NULL,
  "pending_count" integer NOT NULL,
  "minted_amount" numeric(30, 0) NOT NULL,
  "minted_count" integer NOT NULL,
  "voided_amount" numeric(30, 0) NOT NULL,
  "voided_count" integer NOT NULL,
  "refund_pending_amount" numeric(30, 0) NOT NULL,
  "refund_pending_count" integer NOT NULL,
  "refunded_amount" numeric(30, 0) NOT NULL,
  "refunded_count" integer NOT NULL
);
