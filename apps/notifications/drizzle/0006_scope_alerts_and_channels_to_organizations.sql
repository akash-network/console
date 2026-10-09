DROP INDEX "idx_notification_channels_user_id_is_default";--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "notification_channels" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
CREATE INDEX "idx_alerts_organization_id_project_id" ON "alerts" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX "idx_notification_channels_organization_id" ON "notification_channels" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_notification_channels_organization_id_is_default" ON "notification_channels" USING btree ("organization_id","is_default") WHERE is_default = true and deleted_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_notification_channels_user_id_is_default" ON "notification_channels" USING btree ("user_id","is_default") WHERE is_default = true and deleted_at is null and organization_id is null;