CREATE TABLE "deleted_account_abuse_locks" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"identity_hash" varchar(64),
	"email_hash" varchar(64),
	"reason" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "deleted_account_abuse_locks_identity_hash_idx" ON "deleted_account_abuse_locks" USING btree ("identity_hash");--> statement-breakpoint
CREATE INDEX "deleted_account_abuse_locks_email_hash_idx" ON "deleted_account_abuse_locks" USING btree ("email_hash");