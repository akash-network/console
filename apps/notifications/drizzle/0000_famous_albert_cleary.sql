CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; --> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('NORMAL', 'FIRING', 'FIRED');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('CHAIN_MESSAGE', 'DEPLOYMENT_BALANCE');--> statement-breakpoint
CREATE TYPE "public"."contact_point_type" AS ENUM('email');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"contact_point_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"description" text NOT NULL,
	"conditions" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"type" "alert_type" NOT NULL,
	"status" "alert_status" DEFAULT 'NORMAL' NOT NULL,
	"params" jsonb,
	"min_block_height" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_points" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "contact_point_type" NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "block_cursor" (
	"id" text PRIMARY KEY DEFAULT 'latest' NOT NULL,
	"last_processed_block" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_contact_point_id_contact_points_id_fk" FOREIGN KEY ("contact_point_id") REFERENCES "public"."contact_points"("id") ON DELETE no action ON UPDATE no action;