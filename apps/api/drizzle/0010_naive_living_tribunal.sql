CREATE TABLE IF NOT EXISTS "deployment_settings" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"dseq" varchar NOT NULL,
	"auto_top_up_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "dseq_user_id_idx" UNIQUE("dseq","user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployment_settings" ADD CONSTRAINT "deployment_settings_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auto_top_up_enabled_id_idx" ON "deployment_settings" USING btree ("auto_top_up_enabled","id");