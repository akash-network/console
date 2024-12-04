ALTER TABLE "user_wallets" DROP CONSTRAINT "user_wallets_user_id_userSetting_id_fk";
--> statement-breakpoint
ALTER TABLE "userSetting" ADD COLUMN "last_active_at" timestamp DEFAULT now();--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
