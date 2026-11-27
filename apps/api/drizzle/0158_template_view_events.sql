SET lock_timeout = '3s';--> statement-breakpoint
CREATE TYPE "public"."template_view_kind" AS ENUM('page_view', 'configure_open');--> statement-breakpoint
CREATE TABLE "template_view_events" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"template_id" uuid NOT NULL,
	"kind" "template_view_kind" NOT NULL,
	"viewer_key" varchar(64) NOT NULL,
	"network" varchar(16) NOT NULL,
	"viewed_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "template_view_events" ADD CONSTRAINT "template_view_events_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "template_view_events_once_per_day_unique" ON "template_view_events" USING btree ("template_id","network","viewed_on","kind","viewer_key");--> statement-breakpoint
RESET lock_timeout;
