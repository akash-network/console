CREATE TYPE "public"."provider_tier_demotion_notification_status" AS ENUM('PENDING', 'SENT');--> statement-breakpoint
CREATE TABLE "provider_tier_demotion_notifications" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"stream_id" uuid NOT NULL,
	"cursor" bigint NOT NULL,
	"alert_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"owner" text NOT NULL,
	"dseq" text NOT NULL,
	"gseq" integer NOT NULL,
	"oseq" integer NOT NULL,
	"bseq" integer NOT NULL,
	"status" "provider_tier_demotion_notification_status" DEFAULT 'PENDING' NOT NULL,
	"claim_id" uuid NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_tier_demotion_state" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"stream_id" uuid,
	"cursor" bigint DEFAULT 0 NOT NULL,
	"claim_id" uuid,
	"claim_expires_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "provider_tier_demotion_notifications" ADD CONSTRAINT "provider_tier_demotion_notifications_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_tier_demotion_notifications_delivery_uidx" ON "provider_tier_demotion_notifications" USING btree ("stream_id","cursor","alert_id","owner","dseq","gseq","oseq","bseq","provider");--> statement-breakpoint
CREATE INDEX "provider_tier_demotion_notifications_status_idx" ON "provider_tier_demotion_notifications" USING btree ("status","claimed_at");