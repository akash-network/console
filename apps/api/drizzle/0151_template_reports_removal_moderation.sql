SET lock_timeout = '3s';--> statement-breakpoint
CREATE TYPE "public"."template_removed_by" AS ENUM('owner', 'staff');--> statement-breakpoint
CREATE TYPE "public"."template_moderation_action" AS ENUM('hide', 'unhide', 'remove', 'approve_version', 'reject_version', 'rollback_version', 'promote_official', 'remove_official', 'feature', 'unfeature', 'edit_categories', 'accept_image_change', 'suspend_publisher', 'reinstate_publisher', 'verify_publisher', 'unverify_publisher');--> statement-breakpoint
CREATE TYPE "public"."template_report_reason" AS ENUM('malware_or_miner', 'leaks_secrets', 'impersonation', 'spam', 'broken', 'other');--> statement-breakpoint
CREATE TYPE "public"."template_report_status" AS ENUM('open', 'actioned', 'dismissed');--> statement-breakpoint
ALTER TYPE "public"."activity_type" ADD VALUE 'template_update';--> statement-breakpoint
ALTER TYPE "public"."template_version_status" ADD VALUE 'rejected';--> statement-breakpoint
CREATE TABLE "template_moderation_events" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"template_id" uuid,
	"template_version_id" uuid,
	"organization_id" uuid,
	"action" "template_moderation_action" NOT NULL,
	"staff_email" varchar(255) NOT NULL,
	"reason" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "template_moderation_events_reason_not_blank" CHECK (length(btrim("template_moderation_events"."reason")) > 0),
	CONSTRAINT "template_moderation_events_names_its_subject" CHECK ("template_moderation_events"."template_id" IS NOT NULL OR "template_moderation_events"."organization_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "template_reports" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"template_id" uuid NOT NULL,
	"template_version_id" uuid NOT NULL,
	"reporter_user_id" uuid,
	"reporter_organization_id" uuid,
	"reason" "template_report_reason" NOT NULL,
	"details" varchar(1000),
	"status" "template_report_status" DEFAULT 'open' NOT NULL,
	"assignee" varchar(255),
	"resolved_by" varchar(255),
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "template_reports_template_version_reporter_unique" UNIQUE("template_id","template_version_id","reporter_user_id")
);
--> statement-breakpoint
CREATE TABLE "template_tombstones" (
	"template_id" uuid PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"removed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "removed_by" "template_removed_by";--> statement-breakpoint
ALTER TABLE "template_versions" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "template_versions" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "template_reports" ADD CONSTRAINT "template_reports_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_reports" ADD CONSTRAINT "template_reports_template_version_id_template_versions_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."template_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_reports" ADD CONSTRAINT "template_reports_reporter_user_id_userSetting_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."userSetting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_reports" ADD CONSTRAINT "template_reports_reporter_organization_id_organizations_id_fk" FOREIGN KEY ("reporter_organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "template_moderation_events_template_id_created_at_idx" ON "template_moderation_events" USING btree ("template_id","created_at");--> statement-breakpoint
CREATE INDEX "template_moderation_events_organization_id_created_at_idx" ON "template_moderation_events" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "template_reports_status_created_at_idx" ON "template_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "template_reports_reporter_user_id_created_at_idx" ON "template_reports" USING btree ("reporter_user_id","created_at");--> statement-breakpoint
CREATE INDEX "template_reports_reporter_organization_id_created_at_idx" ON "template_reports" USING btree ("reporter_organization_id","created_at");--> statement-breakpoint
RESET lock_timeout;
