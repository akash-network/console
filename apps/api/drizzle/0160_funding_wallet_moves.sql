CREATE TYPE "public"."funding_wallet_move_status" AS ENUM('revoking', 'revoked', 'crediting', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "funding_wallet_moves" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_wallet_id" integer NOT NULL,
	"network" varchar(32) NOT NULL,
	"from_funding_wallet_id" uuid NOT NULL,
	"to_funding_wallet_id" uuid NOT NULL,
	"status" "funding_wallet_move_status" NOT NULL,
	"read_limit" bigint NOT NULL,
	"read_height" bigint NOT NULL,
	"fee_limit" bigint NOT NULL,
	"fee_expires_at" timestamp with time zone,
	"revoke_sent_at" timestamp with time zone,
	"revoke_tx_hash" varchar(64),
	"failure" text,
	"claimed_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "funding_wallet_moves" ADD CONSTRAINT "funding_wallet_moves_from_funding_wallet_id_funding_wallets_id_fk" FOREIGN KEY ("from_funding_wallet_id") REFERENCES "public"."funding_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_wallet_moves" ADD CONSTRAINT "funding_wallet_moves_to_funding_wallet_id_funding_wallets_id_fk" FOREIGN KEY ("to_funding_wallet_id") REFERENCES "public"."funding_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "funding_wallet_moves_user_wallet_source_unique" ON "funding_wallet_moves" USING btree ("user_wallet_id","network","from_funding_wallet_id");--> statement-breakpoint
CREATE INDEX "funding_wallet_moves_source_status_idx" ON "funding_wallet_moves" USING btree ("from_funding_wallet_id","status");