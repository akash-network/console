SET lock_timeout = '3s';--> statement-breakpoint
CREATE TYPE "public"."project_access" AS ENUM('all', 'selected');--> statement-breakpoint
ALTER TABLE "organization_members" ADD COLUMN "project_access" "project_access" DEFAULT 'selected' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD COLUMN "project_access" "project_access" DEFAULT 'selected' NOT NULL;--> statement-breakpoint
RESET lock_timeout;
