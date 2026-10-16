SET lock_timeout = '3s';--> statement-breakpoint
ALTER TYPE "public"."organization_activity_type" ADD VALUE 'organization_renamed';--> statement-breakpoint
RESET lock_timeout;
