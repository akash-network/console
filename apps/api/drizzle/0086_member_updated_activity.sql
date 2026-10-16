SET lock_timeout = '3s';--> statement-breakpoint
ALTER TYPE "public"."organization_activity_type" ADD VALUE 'member_updated';--> statement-breakpoint
RESET lock_timeout;
