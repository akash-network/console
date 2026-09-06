CREATE TYPE "public"."workload_abuse_action" AS ENUM('detected', 'enforcing', 'enforced', 'enforcement_failed');--> statement-breakpoint
CREATE TYPE "public"."workload_abuse_verdict" AS ENUM('hard', 'soft', 'proxy');--> statement-breakpoint
CREATE TABLE "workload_abuse_detections" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"wallet_id" integer NOT NULL,
	"dseq" varchar NOT NULL,
	"provider" varchar(255) NOT NULL,
	"verdict" "workload_abuse_verdict" NOT NULL,
	"probe_status" varchar(64) NOT NULL,
	"signals" jsonb NOT NULL,
	"evidence_excerpt" text NOT NULL,
	"action" "workload_abuse_action" DEFAULT 'detected' NOT NULL,
	"enforcement_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workload_abuse_detections" ADD CONSTRAINT "workload_abuse_detections_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workload_abuse_detections_user_id_idx" ON "workload_abuse_detections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workload_abuse_detections_dseq_idx" ON "workload_abuse_detections" USING btree ("dseq");