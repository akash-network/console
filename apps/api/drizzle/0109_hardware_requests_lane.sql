SET lock_timeout = '3s';--> statement-breakpoint
CREATE TYPE "public"."hardware_request_lane" AS ENUM('sales', 'automated');--> statement-breakpoint
ALTER TABLE "hardware_requests" ADD COLUMN "lane" "hardware_request_lane";--> statement-breakpoint
ALTER TABLE "hardware_requests" ADD COLUMN "lane_reason" varchar(32);--> statement-breakpoint
ALTER TABLE "hardware_requests" ADD COLUMN "estimated_monthly_usd" integer;--> statement-breakpoint
RESET lock_timeout;
