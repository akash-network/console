CREATE TYPE "public"."gpu_waitlist_entry_source" AS ENUM('gpu_menu', 'no_fit', 'no_bids');--> statement-breakpoint
CREATE TYPE "public"."gpu_waitlist_entry_status" AS ENUM('waiting', 'fulfilled', 'left', 'expired');--> statement-breakpoint
CREATE TABLE "gpu_waitlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"vendor" varchar(100) NOT NULL,
	"model" varchar(100) NOT NULL,
	"memory" varchar(100),
	"interface" varchar(100),
	"pool_key" varchar(320) NOT NULL,
	"gpu_count" integer NOT NULL,
	"source" "gpu_waitlist_entry_source" NOT NULL,
	"status" "gpu_waitlist_entry_status" DEFAULT 'waiting' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_notified_at" timestamp with time zone,
	"notified_count" integer DEFAULT 0 NOT NULL,
	"still_wanted_asked_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gpu_waitlist_pools" (
	"pool_key" varchar(320) PRIMARY KEY NOT NULL,
	"last_free_units" integer NOT NULL,
	"last_max_node_free_units" integer NOT NULL,
	"last_check_at" timestamp with time zone,
	"last_check_price_usd_per_hour" numeric,
	"wave_started_at" timestamp with time zone,
	"wave_number" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gpu_waitlist_entries" ADD CONSTRAINT "gpu_waitlist_entries_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gpu_waitlist_entries" ADD CONSTRAINT "gpu_waitlist_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gpu_waitlist_entries_pool_key_status_joined_at_idx" ON "gpu_waitlist_entries" USING btree ("pool_key","status","joined_at");--> statement-breakpoint
CREATE INDEX "gpu_waitlist_entries_user_id_status_idx" ON "gpu_waitlist_entries" USING btree ("user_id","status");