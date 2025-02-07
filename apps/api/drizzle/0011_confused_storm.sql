DROP INDEX IF EXISTS "auto_top_up_enabled_id_idx";--> statement-breakpoint
ALTER TABLE "deployment_settings" ADD COLUMN "closed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "id_auto_top_up_enabled_closed_idx" ON "deployment_settings" USING btree ("id","auto_top_up_enabled","closed");