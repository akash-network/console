CREATE TABLE "gpu_market_prices" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"vendor" varchar(64) NOT NULL,
	"model" varchar(255) NOT NULL,
	"ram" varchar(32),
	"interface" varchar(32),
	"area" varchar(16),
	"source" varchar(16) NOT NULL,
	"low_usd_per_gpu_hour" double precision,
	"median_usd_per_gpu_hour" double precision,
	"high_usd_per_gpu_hour" double precision,
	"sample_count" integer NOT NULL,
	"provider_count" integer NOT NULL,
	"newest_sample_at" timestamp with time zone NOT NULL,
	"window_days" integer NOT NULL,
	"computed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "gpu_market_prices_vendor_model_idx" ON "gpu_market_prices" USING btree ("vendor","model");