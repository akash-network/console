CREATE TABLE "closure_notices" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"alert_id" uuid NOT NULL,
	"notification_channel_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"project_id" uuid,
	"owner" text NOT NULL,
	"dseq" text NOT NULL,
	"deployment_label" text NOT NULL,
	"deployment_link" text NOT NULL,
	"deployment_closed" boolean NOT NULL,
	"provider_label" text,
	"lease_closed_reason" integer,
	"created_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "closure_notices" ADD CONSTRAINT "closure_notices_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closure_notices" ADD CONSTRAINT "closure_notices_notification_channel_id_notification_channels_id_fk" FOREIGN KEY ("notification_channel_id") REFERENCES "public"."notification_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_closure_notices_pending_alert_id" ON "closure_notices" USING btree ("alert_id") WHERE sent_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_closure_notices_notification_channel_id_sent_at" ON "closure_notices" USING btree ("notification_channel_id","sent_at");--> statement-breakpoint
CREATE INDEX "idx_closure_notices_sent_at" ON "closure_notices" USING btree ("sent_at");