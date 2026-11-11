CREATE TABLE "deleted_trial_accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"identity_hash" varchar(64),
	"email_hash" varchar(64),
	"wallet_address" varchar,
	"refused_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "deleted_trial_accounts_identity_hash_idx" ON "deleted_trial_accounts" USING btree ("identity_hash");--> statement-breakpoint
CREATE INDEX "deleted_trial_accounts_email_hash_idx" ON "deleted_trial_accounts" USING btree ("email_hash");