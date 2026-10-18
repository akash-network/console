SET lock_timeout = '3s';--> statement-breakpoint
ALTER TABLE "data_keys" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "data_keys" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "data_keys" ADD CONSTRAINT "data_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
CREATE UNIQUE INDEX "data_keys_active_organization_id_idx" ON "data_keys" USING btree ("organization_id") WHERE "data_keys"."retired_at" IS NULL;--> statement-breakpoint
ALTER TABLE "data_keys" ADD CONSTRAINT "data_keys_one_owner" CHECK (num_nonnulls("data_keys"."user_id", "data_keys"."organization_id") = 1) NOT VALID;--> statement-breakpoint
RESET lock_timeout;
