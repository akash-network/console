CREATE TYPE "public"."organization_activity_type" AS ENUM('organization_created', 'project_created', 'member_invited', 'member_joined', 'deployment_created', 'deployment_closed', 'deployment_moved');--> statement-breakpoint
CREATE TABLE "organization_activities" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"actor_user_id" uuid,
	"type" "organization_activity_type" NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_activities" ADD CONSTRAINT "organization_activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_activities" ADD CONSTRAINT "organization_activities_actor_user_id_userSetting_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."userSetting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_activities" ADD CONSTRAINT "organization_activities_organization_id_project_id_fk" FOREIGN KEY ("organization_id","project_id") REFERENCES "public"."projects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_activities_organization_id_created_at_id_idx" ON "organization_activities" USING btree ("organization_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);