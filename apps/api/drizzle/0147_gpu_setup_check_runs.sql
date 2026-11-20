CREATE TABLE "gpu_setup_check_runs" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"dseq" varchar(32) NOT NULL,
	"setup_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "gpu_setup_check_runs_created_at_idx" ON "gpu_setup_check_runs" USING btree ("created_at");