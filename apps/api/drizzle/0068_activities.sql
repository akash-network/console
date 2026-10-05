CREATE TYPE "public"."activity_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."activity_type" AS ENUM('deployment_close');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "activity_type" NOT NULL,
	"status" "activity_status" NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"seen_at" timestamp with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_user_id_created_at_id_idx" ON "activities" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "activities_user_id_unseen_idx" ON "activities" USING btree ("user_id") WHERE "activities"."seen_at" IS NULL;