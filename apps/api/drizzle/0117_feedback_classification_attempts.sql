ALTER TABLE "feedback_submissions" ADD COLUMN "classification_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "feedback_submissions" ADD COLUMN "classification_failed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assistant_conversations" ADD COLUMN "classification_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "assistant_conversations" ADD COLUMN "classification_failed_at" timestamp with time zone;