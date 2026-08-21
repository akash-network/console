ALTER TABLE "deployment_settings" ADD COLUMN "runtime_limit_hours" integer;--> statement-breakpoint
ALTER TABLE "deployment_settings" ADD COLUMN "runtime_ends_at" timestamp with time zone;