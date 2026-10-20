CREATE TABLE "gpu_bid_checks" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"provider" varchar(255) NOT NULL,
	"vendor" varchar(64) NOT NULL,
	"model" varchar(255) NOT NULL,
	"source" varchar(32) NOT NULL,
	"dseq" varchar(32) NOT NULL,
	"screened" boolean NOT NULL,
	"bid" boolean NOT NULL,
	"checked_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "gpu_bid_checks_provider_model_checked_at_idx" ON "gpu_bid_checks" USING btree ("provider","vendor","model","checked_at");--> statement-breakpoint
CREATE INDEX "gpu_bid_checks_checked_at_idx" ON "gpu_bid_checks" USING btree ("checked_at");