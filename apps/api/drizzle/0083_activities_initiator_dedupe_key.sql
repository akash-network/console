SET lock_timeout = '3s';--> statement-breakpoint
CREATE TYPE "public"."activity_initiator" AS ENUM('user', 'system');--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "initiator" "activity_initiator" DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "activities_user_id_dedupe_key_idx" ON "activities" USING btree ("user_id","dedupe_key") WHERE "activities"."dedupe_key" IS NOT NULL;--> statement-breakpoint
RESET lock_timeout;