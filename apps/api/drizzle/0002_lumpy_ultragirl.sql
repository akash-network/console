CREATE EXTENSION IF NOT EXISTS "uuid-ossp";--> statement-breakpoint
DROP INDEX IF EXISTS "user_setting_username";--> statement-breakpoint
ALTER TABLE "userSetting" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();--> statement-breakpoint
ALTER TABLE "userSetting" ALTER COLUMN "userId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "userSetting" ALTER COLUMN "username" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "userSetting" ADD CONSTRAINT "userSetting_userId_unique" UNIQUE("userId");--> statement-breakpoint
ALTER TABLE "userSetting" ADD CONSTRAINT "userSetting_username_unique" UNIQUE("username");