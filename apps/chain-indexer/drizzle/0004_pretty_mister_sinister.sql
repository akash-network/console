CREATE TYPE "cosmos"."proposal_status" AS ENUM('deposit_period', 'voting_period', 'passed', 'rejected', 'failed');--> statement-breakpoint
CREATE TYPE "cosmos"."vote_option" AS ENUM('yes', 'abstain', 'no', 'no_with_veto');--> statement-breakpoint
CREATE TABLE "cosmos"."proposal_deposits" (
	"proposal_id" bigint NOT NULL,
	"depositor_account_id" integer NOT NULL,
	"amount" jsonb NOT NULL,
	"height" bigint NOT NULL,
	CONSTRAINT "proposal_deposits_proposal_id_depositor_account_id_height_pk" PRIMARY KEY("proposal_id","depositor_account_id","height")
);
--> statement-breakpoint
CREATE TABLE "cosmos"."proposal_votes" (
	"proposal_id" bigint NOT NULL,
	"voter_account_id" integer NOT NULL,
	"options" jsonb NOT NULL,
	"height" bigint NOT NULL,
	CONSTRAINT "proposal_votes_proposal_id_voter_account_id_pk" PRIMARY KEY("proposal_id","voter_account_id")
);
--> statement-breakpoint
CREATE TABLE "cosmos"."proposals" (
	"id" bigint PRIMARY KEY NOT NULL,
	"proposer_account_id" integer,
	"title" text,
	"summary" text,
	"messages" jsonb,
	"metadata" text,
	"status" "cosmos"."proposal_status" NOT NULL,
	"submit_time" timestamp with time zone,
	"deposit_end_time" timestamp with time zone,
	"voting_start_time" timestamp with time zone,
	"voting_end_time" timestamp with time zone,
	"total_deposit" jsonb,
	"final_tally_yes" numeric(38, 0),
	"final_tally_abstain" numeric(38, 0),
	"final_tally_no" numeric(38, 0),
	"final_tally_no_with_veto" numeric(38, 0),
	"submit_height" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cosmos"."proposal_deposits" ADD CONSTRAINT "proposal_deposits_depositor_account_id_accounts_id_fk" FOREIGN KEY ("depositor_account_id") REFERENCES "cosmos"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cosmos"."proposal_votes" ADD CONSTRAINT "proposal_votes_voter_account_id_accounts_id_fk" FOREIGN KEY ("voter_account_id") REFERENCES "cosmos"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cosmos"."proposals" ADD CONSTRAINT "proposals_proposer_account_id_accounts_id_fk" FOREIGN KEY ("proposer_account_id") REFERENCES "cosmos"."accounts"("id") ON DELETE no action ON UPDATE no action;