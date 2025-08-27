CREATE TABLE IF NOT EXISTS "user_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"snapshot_date" timestamp DEFAULT now() NOT NULL,
	"total_spend" decimal(20,8) DEFAULT '0' NOT NULL,
	"total_credit_purchases" integer DEFAULT 0 NOT NULL,
	"coupons_claimed" integer DEFAULT 0 NOT NULL,
	"active_leases_count" integer DEFAULT 0 NOT NULL,
	"total_akt_spent" decimal(20,8) DEFAULT '0' NOT NULL,
	"total_usdc_spent" decimal(20,8) DEFAULT '0' NOT NULL,
	"total_usd_spent" decimal(20,8) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Create index for efficient queries by user_id and snapshot_date
CREATE INDEX IF NOT EXISTS "user_snapshot_user_id_snapshot_date_idx" ON "user_snapshot" ("user_id", "snapshot_date" DESC);

-- Create index for cleanup queries
CREATE INDEX IF NOT EXISTS "user_snapshot_snapshot_date_idx" ON "user_snapshot" ("snapshot_date");
