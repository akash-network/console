SET lock_timeout = '3s';--> statement-breakpoint
CREATE TYPE "public"."template_source" AS ENUM('console', 'awesome_akash');--> statement-breakpoint
CREATE TYPE "public"."template_usage_action" AS ENUM('deploy', 'lease_created', 'still_running_24h', 'fork', 'favorite', 'unfavorite');--> statement-breakpoint
CREATE TABLE "template_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"source" "template_source" NOT NULL,
	"template_ref" varchar(255) NOT NULL,
	"template_version_id" uuid,
	"action" "template_usage_action" NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"deployment_setting_id" uuid,
	"dseq" varchar,
	"network" varchar(16) NOT NULL,
	"is_trial" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "template_usage_events" ADD CONSTRAINT "template_usage_events_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_usage_events" ADD CONSTRAINT "template_usage_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "template_usage_events_ref_action_created_idx" ON "template_usage_events" USING btree ("source","template_ref","action","created_at","network");--> statement-breakpoint
CREATE INDEX "template_usage_events_user_id_idx" ON "template_usage_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "template_usage_events_organization_id_idx" ON "template_usage_events" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "template_usage_events_deployment_action_unique" ON "template_usage_events" USING btree ("deployment_setting_id","action") WHERE "template_usage_events"."deployment_setting_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "template_usage_events_user_favorite_unique" ON "template_usage_events" USING btree ("source","template_ref","user_id","action") WHERE "template_usage_events"."action" IN ('favorite', 'unfavorite');--> statement-breakpoint
RESET lock_timeout;
