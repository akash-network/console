CREATE TABLE IF NOT EXISTS "wallet_settings" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"wallet_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"auto_reload_enabled" boolean DEFAULT false NOT NULL,
	"auto_reload_threshold" numeric(20, 2),
	"auto_reload_amount" numeric(20, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "wallet_settings_wallet_id_unique" UNIQUE("wallet_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wallet_settings" ADD CONSTRAINT "wallet_settings_wallet_id_user_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."user_wallets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wallet_settings" ADD CONSTRAINT "wallet_settings_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_settings_user_id_idx" ON "wallet_settings" USING btree ("user_id");