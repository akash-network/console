ALTER TABLE "deployment_balance_alerts" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "raw_alerts" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;