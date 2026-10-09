CREATE TYPE "public"."activity_initiator" AS ENUM('user', 'system');--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "initiator" "activity_initiator" DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
UPDATE "activities" SET "dedupe_key" = 'deployment_close.' || ("meta"->>'dseq')
WHERE "id" IN (
	SELECT DISTINCT ON ("user_id", "meta"->>'dseq') "id"
	FROM "activities"
	WHERE "type" = 'deployment_close' AND "status" IN ('pending', 'succeeded') AND "meta"->>'dseq' IS NOT NULL
	ORDER BY "user_id", "meta"->>'dseq', "status" = 'pending' DESC, "created_at" DESC
);--> statement-breakpoint
CREATE UNIQUE INDEX "activities_user_id_dedupe_key_idx" ON "activities" USING btree ("user_id","dedupe_key") WHERE "activities"."dedupe_key" IS NOT NULL;
