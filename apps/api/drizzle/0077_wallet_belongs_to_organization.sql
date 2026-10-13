SET lock_timeout = '3s';--> statement-breakpoint
ALTER TABLE "user_wallets" DROP CONSTRAINT "user_wallets_user_id_userSetting_id_fk";
--> statement-breakpoint
ALTER TABLE "user_wallets" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_wallets" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_created_by_user_id_userSetting_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."userSetting"("id") ON DELETE set null ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE set null ON UPDATE no action NOT VALID;--> statement-breakpoint
RESET lock_timeout;