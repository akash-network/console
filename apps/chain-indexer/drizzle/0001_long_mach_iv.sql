CREATE TYPE "cosmos"."balance_change_reason" AS ENUM('genesis', 'transfer', 'fee', 'reward', 'commission', 'slash', 'gov', 'ibc', 'escrow', 'bme', 'mint', 'burn');--> statement-breakpoint
CREATE TABLE "cosmos"."account_balances" (
	"account_id" integer NOT NULL,
	"denom" text NOT NULL,
	"amount" numeric(38, 0) NOT NULL,
	CONSTRAINT "account_balances_account_id_denom_pk" PRIMARY KEY("account_id","denom")
);
--> statement-breakpoint
CREATE TABLE "cosmos"."accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"account_number" bigint,
	"account_type" text,
	"is_module_account" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cosmos"."balance_changes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"denom" text NOT NULL,
	"delta" numeric(38, 0) NOT NULL,
	"balance_after" numeric(38, 0) NOT NULL,
	"reason" "cosmos"."balance_change_reason" NOT NULL,
	"height" bigint NOT NULL,
	"counterparty_account_id" integer
);
--> statement-breakpoint
CREATE TABLE "cosmos"."delegations" (
	"delegator_account_id" integer NOT NULL,
	"validator_operator_address" text NOT NULL,
	"shares" numeric(38, 18) NOT NULL,
	CONSTRAINT "delegations_delegator_account_id_validator_operator_address_pk" PRIMARY KEY("delegator_account_id","validator_operator_address")
);
--> statement-breakpoint
CREATE TABLE "cosmos"."validators" (
	"operator_address" text PRIMARY KEY NOT NULL,
	"account_address" text,
	"hex_address" text,
	"moniker" text,
	"identity" text,
	"website" text,
	"details" text,
	"security_contact" text,
	"commission_rate" numeric(20, 18),
	"commission_max_rate" numeric(20, 18),
	"commission_max_change_rate" numeric(20, 18),
	"min_self_delegation" numeric(38, 0)
);
--> statement-breakpoint
ALTER TABLE "cosmos"."account_balances" ADD CONSTRAINT "account_balances_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "cosmos"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cosmos"."balance_changes" ADD CONSTRAINT "balance_changes_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "cosmos"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cosmos"."balance_changes" ADD CONSTRAINT "balance_changes_counterparty_account_id_accounts_id_fk" FOREIGN KEY ("counterparty_account_id") REFERENCES "cosmos"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cosmos"."delegations" ADD CONSTRAINT "delegations_delegator_account_id_accounts_id_fk" FOREIGN KEY ("delegator_account_id") REFERENCES "cosmos"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_address_idx" ON "cosmos"."accounts" USING btree ("address");--> statement-breakpoint
CREATE INDEX "balance_changes_account_denom_height_idx" ON "cosmos"."balance_changes" USING btree ("account_id","denom","height");