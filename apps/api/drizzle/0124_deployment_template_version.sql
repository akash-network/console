SET lock_timeout = '3s';--> statement-breakpoint
ALTER TABLE "deployment_settings" ADD COLUMN "template_version_id" uuid;--> statement-breakpoint
RESET lock_timeout;
