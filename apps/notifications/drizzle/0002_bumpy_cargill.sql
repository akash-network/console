DROP INDEX "idx_alerts_type_enabled";--> statement-breakpoint
ALTER TABLE "notification_channels" ADD COLUMN "deleted_at" timestamp;