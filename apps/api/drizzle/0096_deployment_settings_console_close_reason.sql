SET lock_timeout = '3s';--> statement-breakpoint
CREATE TYPE "public"."console_close_reason" AS ENUM('runtime_limit_reached', 'trial_ended', 'provider_unreachable', 'no_lease');--> statement-breakpoint
ALTER TABLE "deployment_settings" ADD COLUMN "console_close_reason" "console_close_reason";--> statement-breakpoint
RESET lock_timeout;
