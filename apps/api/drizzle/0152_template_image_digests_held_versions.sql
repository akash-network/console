SET lock_timeout = '3s';--> statement-breakpoint
CREATE TYPE "public"."template_image_change_status" AS ENUM('open', 'accepted', 'hidden');--> statement-breakpoint
CREATE TABLE "template_image_changes" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"template_id" uuid NOT NULL,
	"template_version_id" uuid NOT NULL,
	"image" varchar(512) NOT NULL,
	"old_digest" varchar(160) NOT NULL,
	"new_digest" varchar(160) NOT NULL,
	"status" "template_image_change_status" DEFAULT 'open' NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_by" varchar(255),
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "template_versions" ADD COLUMN "hold_reasons" jsonb;--> statement-breakpoint
ALTER TABLE "template_image_changes" ADD CONSTRAINT "template_image_changes_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_image_changes" ADD CONSTRAINT "template_image_changes_template_version_id_template_versions_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."template_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "template_image_changes_open_template_image_unique" ON "template_image_changes" USING btree ("template_id","image") WHERE "template_image_changes"."status" = 'open';--> statement-breakpoint
CREATE INDEX "template_image_changes_status_detected_at_idx" ON "template_image_changes" USING btree ("status","detected_at");--> statement-breakpoint
RESET lock_timeout;
