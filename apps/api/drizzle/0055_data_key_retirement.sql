ALTER TABLE "data_keys" DROP CONSTRAINT "data_keys_user_id_unique";--> statement-breakpoint
ALTER TABLE "data_keys" ADD COLUMN "retired_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "data_keys_active_user_id_idx" ON "data_keys" USING btree ("user_id") WHERE "data_keys"."retired_at" IS NULL;