CREATE TYPE "akash"."bme_mint_status" AS ENUM('mint_status_unspecified', 'mint_status_healthy', 'mint_status_warning', 'mint_status_halt_cr', 'mint_status_halt_oracle');--> statement-breakpoint
CREATE TABLE "akash"."bme_canceled_records" (
	"denom" text NOT NULL,
	"to_denom" text NOT NULL,
	"source" text NOT NULL,
	"record_height" bigint NOT NULL,
	"sequence" bigint NOT NULL,
	"height" bigint NOT NULL,
	"tx_index" integer,
	"cancel_reason" text NOT NULL,
	"owner_account_id" integer NOT NULL,
	"to_account_id" integer NOT NULL,
	"coins_to_burn_denom" text,
	"coins_to_burn_amount" numeric(38, 0),
	"denom_to_mint" text NOT NULL,
	CONSTRAINT "bme_canceled_records_record_height_sequence_denom_to_denom_source_pk" PRIMARY KEY("record_height","sequence","denom","to_denom","source")
);
--> statement-breakpoint
CREATE TABLE "akash"."bme_ledger_records" (
	"denom" text NOT NULL,
	"to_denom" text NOT NULL,
	"source" text NOT NULL,
	"record_height" bigint NOT NULL,
	"sequence" bigint NOT NULL,
	"height" bigint NOT NULL,
	"tx_index" integer,
	"burned_from_account_id" integer NOT NULL,
	"minted_to_account_id" integer NOT NULL,
	"burned_denom" text,
	"burned_amount" numeric(38, 0) DEFAULT '0' NOT NULL,
	"burned_price" numeric(38, 18),
	"minted_denom" text,
	"minted_amount" numeric(38, 0) DEFAULT '0' NOT NULL,
	"minted_price" numeric(38, 18),
	"spread_denom" text,
	"spread_amount" numeric(38, 0),
	"remint_credit_issued_amount" numeric(38, 0),
	"remint_credit_accrued_amount" numeric(38, 0),
	CONSTRAINT "bme_ledger_records_record_height_sequence_denom_to_denom_source_pk" PRIMARY KEY("record_height","sequence","denom","to_denom","source")
);
--> statement-breakpoint
CREATE TABLE "akash"."bme_status_changes" (
	"height" bigint NOT NULL,
	"ordinal" integer NOT NULL,
	"previous_status" "akash"."bme_mint_status" NOT NULL,
	"new_status" "akash"."bme_mint_status" NOT NULL,
	"collateral_ratio" numeric(38, 18) NOT NULL,
	CONSTRAINT "bme_status_changes_height_ordinal_pk" PRIMARY KEY("height","ordinal")
);
--> statement-breakpoint
ALTER TABLE "akash"."bme_canceled_records" ADD CONSTRAINT "bme_canceled_records_owner_account_id_accounts_id_fk" FOREIGN KEY ("owner_account_id") REFERENCES "cosmos"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "akash"."bme_canceled_records" ADD CONSTRAINT "bme_canceled_records_to_account_id_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "cosmos"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "akash"."bme_ledger_records" ADD CONSTRAINT "bme_ledger_records_burned_from_account_id_accounts_id_fk" FOREIGN KEY ("burned_from_account_id") REFERENCES "cosmos"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "akash"."bme_ledger_records" ADD CONSTRAINT "bme_ledger_records_minted_to_account_id_accounts_id_fk" FOREIGN KEY ("minted_to_account_id") REFERENCES "cosmos"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bme_canceled_records_height_idx" ON "akash"."bme_canceled_records" USING btree ("height");--> statement-breakpoint
CREATE INDEX "bme_ledger_records_height_idx" ON "akash"."bme_ledger_records" USING btree ("height");--> statement-breakpoint
CREATE INDEX "bme_ledger_records_burned_denom_height_idx" ON "akash"."bme_ledger_records" USING btree ("burned_denom","height");--> statement-breakpoint
CREATE INDEX "bme_ledger_records_minted_denom_height_idx" ON "akash"."bme_ledger_records" USING btree ("minted_denom","height");