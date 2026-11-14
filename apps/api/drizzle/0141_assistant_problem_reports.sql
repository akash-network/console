CREATE TYPE "public"."assistant_turn_rating" AS ENUM('up', 'down');--> statement-breakpoint
CREATE TYPE "public"."assistant_problem_report_status" AS ENUM('new', 'triaged', 'fixed');--> statement-breakpoint
CREATE TABLE "assistant_problem_reports" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"conversation_id" uuid NOT NULL,
	"turn_trace_id" uuid,
	"note" text,
	"transcript" jsonb,
	"consent_copy_version" varchar(64) NOT NULL,
	"status" "assistant_problem_report_status" DEFAULT 'new' NOT NULL,
	"classification_type" "feedback_classification_type",
	"classification_summary" text,
	"sentiment_score" double precision,
	"ended_stuck" boolean,
	"classified_at" timestamp with time zone,
	"classification_attempts" integer DEFAULT 0 NOT NULL,
	"classification_failed_at" timestamp with time zone,
	"theme_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_turn_traces" ADD COLUMN "rating" "assistant_turn_rating";--> statement-breakpoint
ALTER TABLE "assistant_problem_reports" ADD CONSTRAINT "assistant_problem_reports_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_problem_reports" ADD CONSTRAINT "assistant_problem_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_problem_reports" ADD CONSTRAINT "assistant_problem_reports_turn_trace_id_assistant_turn_traces_id_fk" FOREIGN KEY ("turn_trace_id") REFERENCES "public"."assistant_turn_traces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_problem_reports" ADD CONSTRAINT "assistant_problem_reports_theme_id_feedback_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."feedback_themes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_problem_reports_user_id_created_at_idx" ON "assistant_problem_reports" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "assistant_problem_reports_conversation_id_idx" ON "assistant_problem_reports" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "assistant_problem_reports_status_created_at_idx" ON "assistant_problem_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "assistant_problem_reports_theme_id_idx" ON "assistant_problem_reports" USING btree ("theme_id");