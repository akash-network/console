SET lock_timeout = '3s';--> statement-breakpoint
ALTER TABLE "template_versions" ADD COLUMN "changes" jsonb;--> statement-breakpoint
RESET lock_timeout;
