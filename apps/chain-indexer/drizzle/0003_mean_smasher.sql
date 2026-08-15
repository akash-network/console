CREATE TYPE "cosmos"."validator_status" AS ENUM('unbonded', 'unbonding', 'bonded');--> statement-breakpoint
CREATE TABLE "cosmos"."unbonding_delegations" (
	"delegator_account_id" integer NOT NULL,
	"validator_operator_address" text NOT NULL,
	"creation_height" bigint NOT NULL,
	"completion_time" timestamp with time zone NOT NULL,
	"initial_balance" numeric(38, 0) NOT NULL,
	"balance" numeric(38, 0) NOT NULL,
	CONSTRAINT "unbonding_delegations_delegator_account_id_validator_operator_address_creation_height_pk" PRIMARY KEY("delegator_account_id","validator_operator_address","creation_height")
);
--> statement-breakpoint
ALTER TABLE "cosmos"."validators" ADD COLUMN "jailed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cosmos"."validators" ADD COLUMN "status" "cosmos"."validator_status";--> statement-breakpoint
ALTER TABLE "cosmos"."validators" ADD COLUMN "tokens" numeric(38, 0);--> statement-breakpoint
ALTER TABLE "cosmos"."validators" ADD COLUMN "delegator_shares" numeric(38, 18);--> statement-breakpoint
ALTER TABLE "cosmos"."validators" ADD COLUMN "unbonding_height" bigint;--> statement-breakpoint
ALTER TABLE "cosmos"."validators" ADD COLUMN "unbonding_time" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cosmos"."unbonding_delegations" ADD CONSTRAINT "unbonding_delegations_delegator_account_id_accounts_id_fk" FOREIGN KEY ("delegator_account_id") REFERENCES "cosmos"."accounts"("id") ON DELETE no action ON UPDATE no action;