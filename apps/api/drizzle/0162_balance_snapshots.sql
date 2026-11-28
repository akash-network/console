CREATE TYPE "public"."balance_snapshot_status" AS ENUM('running', 'complete', 'failed');--> statement-breakpoint
CREATE TABLE "balance_snapshot_grants" (
	"snapshot_id" uuid NOT NULL,
	"granter" varchar(128) NOT NULL,
	"grantee" varchar(128) NOT NULL,
	"denom" varchar(32) NOT NULL,
	"amount" bigint NOT NULL,
	CONSTRAINT "balance_snapshot_grants_pk" PRIMARY KEY("snapshot_id","granter","grantee","denom")
);
--> statement-breakpoint
CREATE TABLE "balance_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"network" varchar(32) NOT NULL,
	"taken_on" date NOT NULL,
	"status" "balance_snapshot_status" NOT NULL,
	"height" bigint NOT NULL,
	"grants_count" integer,
	"failure" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "balance_snapshot_grants" ADD CONSTRAINT "balance_snapshot_grants_snapshot_id_balance_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."balance_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "balance_snapshot_grants_grantee_idx" ON "balance_snapshot_grants" USING btree ("grantee");--> statement-breakpoint
CREATE UNIQUE INDEX "balance_snapshots_network_taken_on_unique" ON "balance_snapshots" USING btree ("network","taken_on");