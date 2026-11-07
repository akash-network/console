CREATE TABLE "unmet_demand_events" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"kind" varchar(16) NOT NULL,
	"vendor" varchar(64),
	"model" varchar(255),
	"gpu_count" integer NOT NULL,
	"region_area" varchar(16),
	"dedupe_key" varchar(64) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	CONSTRAINT "unmet_demand_events_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE INDEX "unmet_demand_events_occurred_at_idx" ON "unmet_demand_events" USING btree ("occurred_at");