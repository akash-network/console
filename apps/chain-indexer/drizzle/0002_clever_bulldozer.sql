CREATE TYPE "cosmos"."account_tx_role" AS ENUM('signer', 'sender', 'receiver');--> statement-breakpoint
ALTER TYPE "cosmos"."balance_change_reason" ADD VALUE 'staking';--> statement-breakpoint
CREATE TABLE "cosmos"."account_txs" (
	"account_id" integer NOT NULL,
	"height" bigint NOT NULL,
	"tx_index" integer NOT NULL,
	"role" "cosmos"."account_tx_role" NOT NULL,
	CONSTRAINT "account_txs_account_id_height_tx_index_role_pk" PRIMARY KEY("account_id","height","tx_index","role")
);
--> statement-breakpoint
ALTER TABLE "cosmos"."balance_changes" ADD COLUMN "tx_index" integer;--> statement-breakpoint
ALTER TABLE "cosmos"."balance_changes" ADD COLUMN "event_index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "cosmos"."account_txs" ADD CONSTRAINT "account_txs_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "cosmos"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "balance_changes_height_event_index_idx" ON "cosmos"."balance_changes" USING btree ("height","event_index");