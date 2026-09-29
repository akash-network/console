CREATE TYPE "public"."hardware_request_category" AS ENUM('gpu_model', 'capacity', 'region', 'other');--> statement-breakpoint
CREATE TABLE "hardware_requests" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" "hardware_request_category" NOT NULL,
	"gpu_model" varchar(100),
	"quantity" integer,
	"region" varchar(100),
	"details" text,
	"contact_email" varchar(255) NOT NULL,
	"configuration" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hardware_requests" ADD CONSTRAINT "hardware_requests_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hardware_requests_user_id_created_at_idx" ON "hardware_requests" USING btree ("user_id","created_at");