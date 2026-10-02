CREATE TYPE "public"."deployment_close_reason" AS ENUM('no_longer_needed', 'cost_or_budget', 'migrating_elsewhere', 'performance_or_reliability', 'testing_or_project_complete', 'other');--> statement-breakpoint
ALTER TABLE "deployment_settings" ADD COLUMN "close_reason" "deployment_close_reason";--> statement-breakpoint
ALTER TABLE "deployment_settings" ADD COLUMN "close_reason_details" text;