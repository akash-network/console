SET lock_timeout = '3s';--> statement-breakpoint
CREATE TYPE "public"."hardware_request_offer_status" AS ENUM('draft', 'published', 'withdrawn', 'accepted', 'declined', 'closed');--> statement-breakpoint
CREATE TABLE "hardware_request_offers" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"hardware_request_id" uuid NOT NULL,
	"status" "hardware_request_offer_status" DEFAULT 'draft' NOT NULL,
	"provider_address" varchar(64) NOT NULL,
	"provider_audited" boolean NOT NULL,
	"provider_uptime_7d" double precision,
	"usd_per_gpu_hour" double precision NOT NULL,
	"terms" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hardware_request_offers" ADD CONSTRAINT "hardware_request_offers_hardware_request_id_hardware_requests_id_fk" FOREIGN KEY ("hardware_request_id") REFERENCES "public"."hardware_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hardware_request_offers_hardware_request_id_created_at_idx" ON "hardware_request_offers" USING btree ("hardware_request_id","created_at");--> statement-breakpoint
RESET lock_timeout;
