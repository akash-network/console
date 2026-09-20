CREATE TABLE "workload_probe_evidence" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"wallet_id" integer NOT NULL,
	"dseq" varchar NOT NULL,
	"provider" text NOT NULL,
	"service" varchar(255) NOT NULL,
	"probe_status" varchar(64) NOT NULL,
	"verdict" varchar(16) NOT NULL,
	"detection_id" uuid,
	"accelerator" jsonb,
	"artifacts" jsonb,
	"process_origins" jsonb,
	"net_shape" jsonb,
	"behavioural_findings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "workload_probe_evidence_wallet_dseq_created_idx" ON "workload_probe_evidence" USING btree ("wallet_id","dseq","created_at");--> statement-breakpoint
CREATE INDEX "workload_probe_evidence_created_idx" ON "workload_probe_evidence" USING btree ("created_at");