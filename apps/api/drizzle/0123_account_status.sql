CREATE TYPE "public"."account_status" AS ENUM('active', 'suspended', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."account_status_action" AS ENUM('suspend', 'reinstate', 'terminate');--> statement-breakpoint
CREATE TABLE "account_status_events" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid,
	"user_email" varchar(255),
	"action" "account_status_action" NOT NULL,
	"actor_staff_id" varchar(255),
	"actor_email" varchar(255) NOT NULL,
	"actor_name" varchar(255) NOT NULL,
	"user_reason" text,
	"internal_note" text,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notification_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "userSetting" ADD COLUMN "account_status" "account_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "account_status_events" ADD CONSTRAINT "account_status_events_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_status_events_user_id_created_at_idx" ON "account_status_events" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "userSetting_account_status_idx" ON "userSetting" USING btree ("account_status");