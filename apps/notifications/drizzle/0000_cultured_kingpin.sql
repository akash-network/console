CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; --> statement-breakpoint
CREATE TYPE "public"."contact_point_type" AS ENUM('email');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('normal', 'firing');--> statement-breakpoint
CREATE TABLE "contact_points" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid,
	"type" "contact_point_type" NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "contact_points_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "deployment_balance_alerts" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid,
	"contact_point_id" uuid,
	"template" text NOT NULL,
	"conditions" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"status" "alert_status" DEFAULT 'normal' NOT NULL,
	"dseq" varchar NOT NULL,
	"owner" varchar NOT NULL,
	"min_block_height" integer,
	CONSTRAINT "deployment_balance_alerts_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "raw_alerts" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid,
	"contact_point_id" uuid,
	"template" text NOT NULL,
	"conditions" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "raw_alerts_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "deployment_balance_alerts" ADD CONSTRAINT "deployment_balance_alerts_contact_point_id_contact_points_id_fk" FOREIGN KEY ("contact_point_id") REFERENCES "public"."contact_points"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_alerts" ADD CONSTRAINT "raw_alerts_contact_point_id_contact_points_id_fk" FOREIGN KEY ("contact_point_id") REFERENCES "public"."contact_points"("id") ON DELETE no action ON UPDATE no action;