CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; --> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('NORMAL', 'FIRING', 'FIRED');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('CHAIN_MESSAGE', 'DEPLOYMENT_BALANCE');--> statement-breakpoint
CREATE TYPE "public"."notification_channel_type" AS ENUM('email');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"notification_channel_id" uuid NOT NULL,
	"name" text NOT NULL,
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
CREATE TABLE "notification_channels" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar NOT NULL,
	"type" "notification_channel_type" NOT NULL,
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
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_notification_channel_id_notification_channels_id_fk" FOREIGN KEY ("notification_channel_id") REFERENCES "public"."notification_channels"("id") ON DELETE no action ON UPDATE no action;