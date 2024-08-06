CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; --> statement-breakpoint
ALTER TABLE "userSetting" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();--> statement-breakpoint
ALTER TABLE "userSetting" ALTER COLUMN "userId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "userSetting" ALTER COLUMN "username" DROP NOT NULL;