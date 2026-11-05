CREATE TYPE "public"."feedback_classification_type" AS ENUM('support_question', 'bug', 'feature_request', 'ux_friction');--> statement-breakpoint
CREATE TYPE "public"."feedback_theme_status" AS ENUM('open', 'merged', 'wont_do', 'linked');--> statement-breakpoint
CREATE TYPE "public"."feedback_deployment_outcome" AS ENUM('live', 'failed');--> statement-breakpoint
CREATE TYPE "public"."feedback_category" AS ENUM('bug', 'feature_request', 'other');--> statement-breakpoint
CREATE TYPE "public"."feedback_kind" AS ENUM('deployment_outcome', 'general');--> statement-breakpoint
CREATE TYPE "public"."assistant_conversation_status" AS ENUM('open', 'resolved', 'unresolved');--> statement-breakpoint
CREATE TYPE "public"."assistant_message_role" AS ENUM('user', 'assistant', 'tool');--> statement-breakpoint
CREATE TABLE "feedback_themes" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"title" varchar(200) NOT NULL,
	"summary" text,
	"type" "feedback_classification_type",
	"status" "feedback_theme_status" DEFAULT 'open' NOT NULL,
	"merged_into_id" uuid,
	"linear_issue_id" varchar(64),
	"linear_issue_url" text,
	"score" double precision DEFAULT 0 NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"distinct_user_count" integer DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_submissions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"kind" "feedback_kind" NOT NULL,
	"dseq" varchar(20),
	"outcome" "feedback_deployment_outcome",
	"dismissed" boolean DEFAULT false NOT NULL,
	"rating" smallint,
	"category" "feedback_category",
	"message" text,
	"context" jsonb NOT NULL,
	"classification_type" "feedback_classification_type",
	"classification_summary" text,
	"sentiment_score" double precision,
	"ended_stuck" boolean,
	"classified_at" timestamp with time zone,
	"theme_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_submissions_rating_range" CHECK ("feedback_submissions"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "assistant_consents" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"copy_version" varchar(64) NOT NULL,
	"processing_accepted_at" timestamp with time zone NOT NULL,
	"review_opt_in" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_conversations" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"status" "assistant_conversation_status" DEFAULT 'open' NOT NULL,
	"resolved_by_user" boolean,
	"context" jsonb NOT NULL,
	"classification_type" "feedback_classification_type",
	"classification_summary" text,
	"sentiment_score" double precision,
	"ended_stuck" boolean,
	"classified_at" timestamp with time zone,
	"theme_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "assistant_messages" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "assistant_message_role" NOT NULL,
	"content" text NOT NULL,
	"tool_name" varchar(100),
	"tool_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_conversation_daily_counts" (
	"day" date PRIMARY KEY NOT NULL,
	"resolved_count" integer DEFAULT 0 NOT NULL,
	"unresolved_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback_themes" ADD CONSTRAINT "feedback_themes_merged_into_id_feedback_themes_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."feedback_themes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_submissions" ADD CONSTRAINT "feedback_submissions_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_submissions" ADD CONSTRAINT "feedback_submissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_submissions" ADD CONSTRAINT "feedback_submissions_theme_id_feedback_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."feedback_themes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_consents" ADD CONSTRAINT "assistant_consents_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_theme_id_feedback_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."feedback_themes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_conversation_id_assistant_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."assistant_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_themes_status_score_idx" ON "feedback_themes" USING btree ("status","score");--> statement-breakpoint
CREATE INDEX "feedback_submissions_user_id_created_at_idx" ON "feedback_submissions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_submissions_user_id_dseq_idx" ON "feedback_submissions" USING btree ("user_id","dseq") WHERE "feedback_submissions"."kind" = 'deployment_outcome';--> statement-breakpoint
CREATE INDEX "feedback_submissions_theme_id_idx" ON "feedback_submissions" USING btree ("theme_id");--> statement-breakpoint
CREATE INDEX "feedback_submissions_unclassified_idx" ON "feedback_submissions" USING btree ("created_at") WHERE "feedback_submissions"."classified_at" IS NULL AND "feedback_submissions"."dismissed" = false;--> statement-breakpoint
CREATE INDEX "assistant_consents_user_id_created_at_idx" ON "assistant_consents" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "assistant_conversations_user_id_started_at_idx" ON "assistant_conversations" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "assistant_conversations_theme_id_idx" ON "assistant_conversations" USING btree ("theme_id");--> statement-breakpoint
CREATE INDEX "assistant_messages_conversation_id_created_at_idx" ON "assistant_messages" USING btree ("conversation_id","created_at");