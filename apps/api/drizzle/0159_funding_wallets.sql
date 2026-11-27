CREATE TYPE "public"."funding_wallet_status" AS ENUM('standby', 'active', 'draining', 'retired');--> statement-breakpoint
CREATE TABLE "funding_wallets" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"network" varchar(32) NOT NULL,
	"address" varchar(128) NOT NULL,
	"status" "funding_wallet_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_wallet_granters" (
	"user_wallet_id" integer NOT NULL,
	"network" varchar(32) NOT NULL,
	"funding_wallet_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_wallet_granters_pk" PRIMARY KEY("user_wallet_id","network")
);
--> statement-breakpoint
ALTER TABLE "user_wallet_granters" ADD CONSTRAINT "user_wallet_granters_funding_wallet_id_funding_wallets_id_fk" FOREIGN KEY ("funding_wallet_id") REFERENCES "public"."funding_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "funding_wallets_network_address_unique" ON "funding_wallets" USING btree ("network","address");--> statement-breakpoint
CREATE UNIQUE INDEX "funding_wallets_one_active_per_network" ON "funding_wallets" USING btree ("network") WHERE "funding_wallets"."status" = 'active';--> statement-breakpoint
CREATE INDEX "user_wallet_granters_funding_wallet_id_idx" ON "user_wallet_granters" USING btree ("funding_wallet_id");