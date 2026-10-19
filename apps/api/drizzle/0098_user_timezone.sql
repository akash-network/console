ALTER TABLE "userSetting" ADD COLUMN "timezone" varchar(64);--> statement-breakpoint
ALTER TABLE "userSetting" ADD COLUMN "timezone_picked_at" timestamp with time zone;