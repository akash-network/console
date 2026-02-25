CREATE TABLE IF NOT EXISTS "email_verification_codes" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"code" varchar(6) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_verification_codes" ADD CONSTRAINT "email_verification_codes_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_verification_codes_user_id_idx" ON "email_verification_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_verification_codes_expires_at_idx" ON "email_verification_codes" USING btree ("expires_at");