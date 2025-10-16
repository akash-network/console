DROP INDEX IF EXISTS "bid_owner_dseq_gseq_oseq_provider";--> statement-breakpoint
DROP INDEX IF EXISTS "lease_owner_dseq_gseq_oseq";--> statement-breakpoint
DROP INDEX IF EXISTS "deployment_group_owner_dseq_gseq";--> statement-breakpoint
DROP INDEX IF EXISTS "lease_provider_address_closed_height_created_height";--> statement-breakpoint
DROP INDEX IF EXISTS "message_height_is_notification_processed";--> statement-breakpoint
DROP INDEX IF EXISTS "message_height_type";--> statement-breakpoint
DROP INDEX IF EXISTS "message_tx_id_is_processed";--> statement-breakpoint
DROP INDEX IF EXISTS "provider_snapshot_owner_check_date";--> statement-breakpoint
ALTER TABLE "bid" ALTER COLUMN "bseq" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "lease" ALTER COLUMN "bseq" SET DEFAULT 0;--> statement-breakpoint
CREATE INDEX "bid_owner_dseq_gseq_oseq_provider_bseq" ON "bid" USING btree ("owner" text_ops,"dseq" text_ops,"gseq" int4_ops,"oseq" int4_ops,"provider" text_ops,"bseq" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "lease_owner_dseq_gseq_oseq_provider_bseq" ON "lease" USING btree ("owner" text_ops,"dseq" text_ops,"gseq" int4_ops,"oseq" int4_ops,"providerAddress" text_ops,"bseq" int4_ops);--> statement-breakpoint
CREATE INDEX "deployment_group_owner_dseq_gseq" ON "deploymentGroup" USING btree ("owner" text_ops,"dseq" text_ops,"gseq" int4_ops);--> statement-breakpoint
CREATE INDEX "lease_provider_address_closed_height_created_height" ON "lease" USING btree ("providerAddress" text_ops,"closedHeight" int4_ops,"createdHeight" int4_ops) WITH (deduplicate_items=true);--> statement-breakpoint
CREATE INDEX "message_height_is_notification_processed" ON "message" USING btree ("height" int4_ops,"isNotificationProcessed" bool_ops) WHERE ("isNotificationProcessed" = false);--> statement-breakpoint
CREATE INDEX "message_height_type" ON "message" USING btree ("height" int4_ops,"type" text_ops);--> statement-breakpoint
CREATE INDEX "message_tx_id_is_processed" ON "message" USING btree ("txId" uuid_ops,"isProcessed" bool_ops);--> statement-breakpoint
CREATE INDEX "provider_snapshot_owner_check_date" ON "providerSnapshot" USING btree ("owner" text_ops,"checkDate" timestamptz_ops);