SET lock_timeout = '3s';--> statement-breakpoint
ALTER TYPE "public"."organization_activity_type" ADD VALUE 'member_granted';--> statement-breakpoint
ALTER TYPE "public"."organization_activity_type" ADD VALUE 'member_revoked';--> statement-breakpoint
RESET lock_timeout;
