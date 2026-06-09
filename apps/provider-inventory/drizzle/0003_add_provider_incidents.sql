CREATE TABLE "provider_incidents" (
	"provider" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_provider_incidents_open_per_provider" ON "provider_incidents" USING btree ("provider") WHERE ended_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_incidents_provider" ON "provider_incidents" USING btree ("provider","started_at");