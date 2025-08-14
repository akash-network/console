DROP INDEX "idx_notification_channels_created_at";--> statement-breakpoint
ALTER TABLE "notification_channels" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_notification_channels_user_id_is_default" ON "notification_channels" USING btree ("user_id","is_default") WHERE is_default = true and deleted_at is null;