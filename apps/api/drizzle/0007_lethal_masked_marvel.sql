ALTER TABLE "userSetting" ADD COLUMN "last_ip" varchar(255);--> statement-breakpoint
ALTER TABLE "userSetting" ADD COLUMN "last_user_agent" varchar(255);--> statement-breakpoint
ALTER TABLE "userSetting" ADD COLUMN "last_fingerprint" varchar(255);