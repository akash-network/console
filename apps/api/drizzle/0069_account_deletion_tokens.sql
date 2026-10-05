CREATE TABLE "account_deletion_tokens" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"acknowledged_forfeit_usd" double precision DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_deletion_tokens" ADD CONSTRAINT "account_deletion_tokens_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_deletion_tokens_user_id_idx" ON "account_deletion_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_deletion_tokens_token_hash_idx" ON "account_deletion_tokens" USING btree ("token_hash");