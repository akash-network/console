SET lock_timeout = '3s';--> statement-breakpoint
CREATE TYPE "public"."hardware_request_event_type" AS ENUM('created_on_behalf', 'status_changed', 'owner_changed', 'lane_changed', 'note', 'offer_published', 'offer_withdrawn', 'offer_accepted', 'offer_declined', 'approval_requested', 'reminder_sent', 'escalated');--> statement-breakpoint
CREATE TABLE "hardware_request_events" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"hardware_request_id" uuid NOT NULL,
	"type" "hardware_request_event_type" NOT NULL,
	"actor" varchar(100),
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hardware_requests" ADD COLUMN "first_replied_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hardware_request_events" ADD CONSTRAINT "hardware_request_events_hardware_request_id_hardware_requests_id_fk" FOREIGN KEY ("hardware_request_id") REFERENCES "public"."hardware_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hardware_request_events_hardware_request_id_created_at_idx" ON "hardware_request_events" USING btree ("hardware_request_id","created_at");--> statement-breakpoint
RESET lock_timeout;
