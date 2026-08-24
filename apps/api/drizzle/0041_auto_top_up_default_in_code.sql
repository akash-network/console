SET lock_timeout = '3s';--> statement-breakpoint
ALTER TABLE "deployment_settings" ALTER COLUMN "auto_top_up_enabled" DROP DEFAULT;--> statement-breakpoint
RESET lock_timeout;
