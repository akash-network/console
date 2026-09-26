CREATE TYPE "public"."job_run_status" AS ENUM('running', 'success', 'failure');--> statement-breakpoint
CREATE TABLE "job_runs" (
	"name" text PRIMARY KEY NOT NULL,
	"last_started_at" timestamp with time zone NOT NULL,
	"last_finished_at" timestamp with time zone,
	"last_status" "job_run_status" NOT NULL,
	"last_error" text,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cosmos"."validators" ADD COLUMN "keybase_username" text;--> statement-breakpoint
ALTER TABLE "cosmos"."validators" ADD COLUMN "keybase_avatar_url" text;