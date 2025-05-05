ALTER TABLE "deployment_balance_alerts" RENAME COLUMN "template" TO "summary";--> statement-breakpoint
ALTER TABLE "raw_alerts" RENAME COLUMN "template" TO "summary";--> statement-breakpoint
ALTER TABLE "contact_points" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "deployment_balance_alerts" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "deployment_balance_alerts" ALTER COLUMN "contact_point_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "raw_alerts" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "raw_alerts" ALTER COLUMN "contact_point_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "deployment_balance_alerts" ADD COLUMN "description" text NOT NULL;--> statement-breakpoint
ALTER TABLE "raw_alerts" ADD COLUMN "description" text NOT NULL;