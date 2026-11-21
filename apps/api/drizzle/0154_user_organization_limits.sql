SET lock_timeout = '3s';--> statement-breakpoint
ALTER TABLE "userSetting" ADD COLUMN "team_organization_limit" integer;--> statement-breakpoint
ALTER TABLE "userSetting" ADD COLUMN "projects_per_organization_limit" integer;--> statement-breakpoint
ALTER TABLE "userSetting" ADD CONSTRAINT "userSetting_team_organization_limit_positive" CHECK ("userSetting"."team_organization_limit" > 0) NOT VALID;--> statement-breakpoint
ALTER TABLE "userSetting" ADD CONSTRAINT "userSetting_projects_per_organization_limit_positive" CHECK ("userSetting"."projects_per_organization_limit" > 0) NOT VALID;--> statement-breakpoint
RESET lock_timeout;