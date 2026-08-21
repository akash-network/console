CREATE TABLE "akash"."daily_prices" (
	"date" date NOT NULL,
	"denom" text NOT NULL,
	"price" numeric(38, 18) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_prices_date_denom_pk" PRIMARY KEY("date","denom")
);
--> statement-breakpoint
CREATE TABLE "akash"."network_rollups" (
	"date" date PRIMARY KEY NOT NULL,
	"close_height" bigint NOT NULL,
	"close_at" timestamp with time zone NOT NULL,
	"active_lease_count" integer NOT NULL,
	"total_lease_count" bigint NOT NULL,
	"daily_lease_count" integer NOT NULL,
	"active_provider_count" integer NOT NULL,
	"active_cpu_units" bigint NOT NULL,
	"active_gpu_units" bigint NOT NULL,
	"active_memory_bytes" bigint NOT NULL,
	"active_ephemeral_storage_bytes" bigint NOT NULL,
	"active_persistent_storage_bytes" bigint NOT NULL,
	"total_uakt_spent" numeric(38, 18) NOT NULL,
	"total_uusdc_spent" numeric(38, 18) NOT NULL,
	"total_uact_spent" numeric(38, 18) NOT NULL,
	"daily_uakt_spent" numeric(38, 18) NOT NULL,
	"daily_uusdc_spent" numeric(38, 18) NOT NULL,
	"daily_uact_spent" numeric(38, 18) NOT NULL,
	"daily_usd_spent" numeric(38, 18),
	"akt_price_used" numeric(38, 18),
	"usd_computed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "akash"."network_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"last_aggregated_height" bigint NOT NULL,
	"last_aggregated_at" timestamp with time zone NOT NULL,
	"active_lease_count" integer DEFAULT 0 NOT NULL,
	"total_lease_count" bigint DEFAULT 0 NOT NULL,
	"active_provider_count" integer DEFAULT 0 NOT NULL,
	"active_cpu_units" bigint DEFAULT 0 NOT NULL,
	"active_gpu_units" bigint DEFAULT 0 NOT NULL,
	"active_memory_bytes" bigint DEFAULT 0 NOT NULL,
	"active_ephemeral_storage_bytes" bigint DEFAULT 0 NOT NULL,
	"active_persistent_storage_bytes" bigint DEFAULT 0 NOT NULL,
	"total_uakt_spent" numeric(38, 18) DEFAULT '0' NOT NULL,
	"total_uusdc_spent" numeric(38, 18) DEFAULT '0' NOT NULL,
	"total_uact_spent" numeric(38, 18) DEFAULT '0' NOT NULL,
	CONSTRAINT "network_state_singleton_check" CHECK ("akash"."network_state"."id" = 1)
);
