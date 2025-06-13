CREATE INDEX "idx_alerts_user_id" ON "alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_alerts_notification_channel_id" ON "alerts" USING btree ("notification_channel_id");--> statement-breakpoint
CREATE INDEX "idx_alerts_type_enabled" ON "alerts" USING btree ("type","enabled");--> statement-breakpoint
CREATE INDEX "idx_alerts_status" ON "alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_alerts_min_block_height_id" ON "alerts" USING btree ("min_block_height","id");--> statement-breakpoint
CREATE INDEX "idx_alerts_created_at_id" ON "alerts" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "idx_alerts_params" ON "alerts" USING gin ("params" jsonb_path_ops);--> statement-breakpoint
CREATE INDEX "idx_alerts_enabled_type_status" ON "alerts" USING btree ("enabled","type","status");--> statement-breakpoint
CREATE INDEX "idx_notification_channels_user_id" ON "notification_channels" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notification_channels_created_at" ON "notification_channels" USING btree ("created_at");