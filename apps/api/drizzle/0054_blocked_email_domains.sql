CREATE TYPE "public"."blocked_email_domain_source" AS ENUM('auto', 'manual');--> statement-breakpoint
CREATE TYPE "public"."blocked_email_domain_status" AS ENUM('blocked', 'allowed');--> statement-breakpoint
CREATE TABLE "blocked_email_domains" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"domain" varchar(253) NOT NULL,
	"status" "blocked_email_domain_status" DEFAULT 'blocked' NOT NULL,
	"source" "blocked_email_domain_source" DEFAULT 'manual' NOT NULL,
	"reason" varchar(255),
	"triggered_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocked_email_domains_domain_normalized" CHECK ("blocked_email_domains"."domain" = lower("blocked_email_domains"."domain") AND "blocked_email_domains"."domain" NOT LIKE '%@%' AND "blocked_email_domains"."domain" LIKE '%.%' AND btrim("blocked_email_domains"."domain") = "blocked_email_domains"."domain")
);
--> statement-breakpoint
ALTER TABLE "blocked_email_domains" ADD CONSTRAINT "blocked_email_domains_triggered_by_user_id_userSetting_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."userSetting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "blocked_email_domains_domain_unique" ON "blocked_email_domains" USING btree ("domain");