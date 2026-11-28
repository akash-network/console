CREATE TABLE "funding_outflow_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"denom" text NOT NULL,
	"scope" text NOT NULL,
	"wallet_address" text,
	"max_amount" bigint NOT NULL,
	"is_enforced" boolean DEFAULT false NOT NULL,
	"set_by" text NOT NULL,
	"set_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_funding_outflow_limits_named_wallet_scope" CHECK (scope = 'wallet' OR wallet_address IS NULL),
	CONSTRAINT "chk_funding_outflow_limits_positive_max" CHECK (max_amount > 0)
);
--> statement-breakpoint
CREATE TABLE "funding_outflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"denom" text NOT NULL,
	"amount" bigint NOT NULL,
	"status" text DEFAULT 'reserved' NOT NULL,
	"tx_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_funding_outflow_limits_shared" ON "funding_outflow_limits" USING btree ("denom","scope") WHERE wallet_address IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_funding_outflow_limits_named_wallet" ON "funding_outflow_limits" USING btree ("denom","wallet_address") WHERE wallet_address IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_funding_outflows_denom_created_at" ON "funding_outflows" USING btree ("denom","created_at");--> statement-breakpoint
CREATE INDEX "idx_funding_outflows_wallet_denom_created_at" ON "funding_outflows" USING btree ("wallet_address","denom","created_at");