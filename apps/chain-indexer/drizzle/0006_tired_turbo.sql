CREATE SCHEMA "akash";
--> statement-breakpoint
CREATE TYPE "akash"."bid_state" AS ENUM('open', 'active', 'closed');--> statement-breakpoint
CREATE TYPE "akash"."deployment_close_reason" AS ENUM('close_message', 'overdrawn', 'close_event');--> statement-breakpoint
CREATE TYPE "akash"."deployment_event_type" AS ENUM('created', 'deposited', 'updated', 'closed', 'group_closed', 'group_paused', 'group_started', 'bid_created', 'bid_closed', 'lease_created', 'lease_closed', 'lease_withdrawn');--> statement-breakpoint
CREATE TYPE "akash"."group_state" AS ENUM('open', 'paused', 'closed');--> statement-breakpoint
CREATE TABLE "akash"."bids" (
	"deployment_id" integer NOT NULL,
	"gseq" integer NOT NULL,
	"oseq" integer NOT NULL,
	"bseq" integer DEFAULT 0 NOT NULL,
	"provider_account_id" integer NOT NULL,
	"price" numeric(38, 18) NOT NULL,
	"denom" text NOT NULL,
	"state" "akash"."bid_state" DEFAULT 'open' NOT NULL,
	"created_height" bigint NOT NULL,
	"closed_height" bigint,
	CONSTRAINT "bids_deployment_id_gseq_oseq_bseq_provider_account_id_pk" PRIMARY KEY("deployment_id","gseq","oseq","bseq","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "akash"."deployment_events" (
	"deployment_id" integer NOT NULL,
	"height" bigint NOT NULL,
	"ordinal" integer NOT NULL,
	"tx_index" integer,
	"msg_index" integer,
	"type" "akash"."deployment_event_type" NOT NULL,
	"details" jsonb,
	CONSTRAINT "deployment_events_deployment_id_height_ordinal_pk" PRIMARY KEY("deployment_id","height","ordinal")
);
--> statement-breakpoint
CREATE TABLE "akash"."deployment_group_resources" (
	"deployment_group_id" integer NOT NULL,
	"idx" integer NOT NULL,
	"count" integer NOT NULL,
	"cpu_units" bigint NOT NULL,
	"gpu_units" bigint NOT NULL,
	"gpu_vendor" text,
	"gpu_model" text,
	"memory_bytes" bigint NOT NULL,
	"ephemeral_storage_bytes" bigint NOT NULL,
	"persistent_storage_bytes" bigint NOT NULL,
	"price" numeric(38, 18) NOT NULL,
	"price_denom" text NOT NULL,
	CONSTRAINT "deployment_group_resources_deployment_group_id_idx_pk" PRIMARY KEY("deployment_group_id","idx")
);
--> statement-breakpoint
CREATE TABLE "akash"."deployment_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"deployment_id" integer NOT NULL,
	"gseq" integer NOT NULL,
	"state" "akash"."group_state" DEFAULT 'open' NOT NULL,
	"closed_height" bigint
);
--> statement-breakpoint
CREATE TABLE "akash"."deployments" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_account_id" integer NOT NULL,
	"dseq" numeric(20, 0) NOT NULL,
	"denom" text NOT NULL,
	"deposit" numeric(38, 0) NOT NULL,
	"balance" numeric(38, 18) NOT NULL,
	"withdrawn_amount" numeric(38, 18) NOT NULL,
	"block_rate" numeric(38, 18) DEFAULT '0' NOT NULL,
	"last_withdraw_height" bigint,
	"last_processed_height" bigint NOT NULL,
	"created_height" bigint NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"closed_height" bigint,
	"closed_at" timestamp with time zone,
	"close_reason" "akash"."deployment_close_reason",
	"cpu_units" bigint NOT NULL,
	"gpu_units" bigint NOT NULL,
	"memory_bytes" bigint NOT NULL,
	"ephemeral_storage_bytes" bigint NOT NULL,
	"persistent_storage_bytes" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "akash"."leases" (
	"deployment_id" integer NOT NULL,
	"deployment_group_id" integer NOT NULL,
	"gseq" integer NOT NULL,
	"oseq" integer NOT NULL,
	"bseq" integer DEFAULT 0 NOT NULL,
	"provider_account_id" integer NOT NULL,
	"price" numeric(38, 18) NOT NULL,
	"denom" text NOT NULL,
	"balance" numeric(38, 18) DEFAULT '0' NOT NULL,
	"withdrawn_amount" numeric(38, 18) DEFAULT '0' NOT NULL,
	"predicted_closed_height" numeric(30, 0) NOT NULL,
	"created_height" bigint NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"closed_height" bigint,
	"closed_at" timestamp with time zone,
	"cpu_units" bigint NOT NULL,
	"gpu_units" bigint NOT NULL,
	"memory_bytes" bigint NOT NULL,
	"ephemeral_storage_bytes" bigint NOT NULL,
	"persistent_storage_bytes" bigint NOT NULL,
	CONSTRAINT "leases_deployment_id_gseq_oseq_bseq_provider_account_id_pk" PRIMARY KEY("deployment_id","gseq","oseq","bseq","provider_account_id")
);
--> statement-breakpoint
ALTER TABLE "akash"."bids" ADD CONSTRAINT "bids_deployment_id_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "akash"."deployments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "akash"."bids" ADD CONSTRAINT "bids_provider_account_id_accounts_id_fk" FOREIGN KEY ("provider_account_id") REFERENCES "cosmos"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "akash"."deployment_events" ADD CONSTRAINT "deployment_events_deployment_id_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "akash"."deployments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "akash"."deployment_group_resources" ADD CONSTRAINT "deployment_group_resources_deployment_group_id_deployment_groups_id_fk" FOREIGN KEY ("deployment_group_id") REFERENCES "akash"."deployment_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "akash"."deployment_groups" ADD CONSTRAINT "deployment_groups_deployment_id_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "akash"."deployments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "akash"."deployments" ADD CONSTRAINT "deployments_owner_account_id_accounts_id_fk" FOREIGN KEY ("owner_account_id") REFERENCES "cosmos"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "akash"."leases" ADD CONSTRAINT "leases_deployment_id_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "akash"."deployments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "akash"."leases" ADD CONSTRAINT "leases_deployment_group_id_deployment_groups_id_fk" FOREIGN KEY ("deployment_group_id") REFERENCES "akash"."deployment_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "akash"."leases" ADD CONSTRAINT "leases_provider_account_id_accounts_id_fk" FOREIGN KEY ("provider_account_id") REFERENCES "cosmos"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deployment_groups_deployment_gseq_idx" ON "akash"."deployment_groups" USING btree ("deployment_id","gseq");--> statement-breakpoint
CREATE UNIQUE INDEX "deployments_owner_dseq_idx" ON "akash"."deployments" USING btree ("owner_account_id","dseq");--> statement-breakpoint
CREATE INDEX "deployments_owner_created_idx" ON "akash"."deployments" USING btree ("owner_account_id","created_height");--> statement-breakpoint
CREATE INDEX "deployments_open_idx" ON "akash"."deployments" USING btree ("created_height") WHERE "akash"."deployments"."closed_height" IS NULL;--> statement-breakpoint
CREATE INDEX "leases_provider_idx" ON "akash"."leases" USING btree ("provider_account_id","closed_height","created_height");--> statement-breakpoint
CREATE INDEX "leases_open_idx" ON "akash"."leases" USING btree ("deployment_id") WHERE "akash"."leases"."closed_height" IS NULL;