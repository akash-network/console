DO $$ BEGIN
 CREATE TYPE "public"."account_stage" AS ENUM('onboarding', 'trial', 'trial_legacy', 'regular');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "userSetting" ADD COLUMN "stage" "account_stage" DEFAULT 'onboarding' NOT NULL;
--> statement-breakpoint
UPDATE "userSetting" u
SET    "stage" = 'regular'
FROM   "user_wallets" w
WHERE  w."user_id" = u."id"
  AND  w."trial" = false;
--> statement-breakpoint
UPDATE "userSetting" u
SET    "stage" = 'trial_legacy'
FROM   "user_wallets" w
WHERE  w."user_id" = u."id"
  AND  w."trial" = true;
