CREATE TABLE "akash"."provider_audit_signatures" (
	"owner_account_id" integer NOT NULL,
	"auditor_account_id" integer NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"height" bigint NOT NULL,
	CONSTRAINT "provider_audit_signatures_owner_account_id_auditor_account_id_key_pk" PRIMARY KEY("owner_account_id","auditor_account_id","key")
);
--> statement-breakpoint
CREATE TABLE "akash"."providers" (
	"owner_account_id" integer PRIMARY KEY NOT NULL,
	"host_uri" text NOT NULL,
	"email" text,
	"website" text,
	"attributes" jsonb NOT NULL,
	"last_processed_height" bigint NOT NULL,
	"created_height" bigint NOT NULL,
	"updated_height" bigint,
	"deleted_height" bigint
);
--> statement-breakpoint
ALTER TABLE "akash"."provider_audit_signatures" ADD CONSTRAINT "provider_audit_signatures_owner_account_id_accounts_id_fk" FOREIGN KEY ("owner_account_id") REFERENCES "cosmos"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "akash"."provider_audit_signatures" ADD CONSTRAINT "provider_audit_signatures_auditor_account_id_accounts_id_fk" FOREIGN KEY ("auditor_account_id") REFERENCES "cosmos"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "akash"."providers" ADD CONSTRAINT "providers_owner_account_id_accounts_id_fk" FOREIGN KEY ("owner_account_id") REFERENCES "cosmos"."accounts"("id") ON DELETE no action ON UPDATE no action;