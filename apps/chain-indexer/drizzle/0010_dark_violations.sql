CREATE TABLE "akash"."act_migration_queue" (
	"position" integer PRIMARY KEY NOT NULL,
	"deployment_id" bigint NOT NULL,
	"converted_at_height" bigint
);
--> statement-breakpoint
CREATE TABLE "akash"."act_migration_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"last_akt_usd_price" numeric(38, 18),
	"last_price_height" bigint,
	CONSTRAINT "act_migration_state_singleton_check" CHECK ("akash"."act_migration_state"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "akash"."act_migration_queue" ADD CONSTRAINT "act_migration_queue_deployment_id_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "akash"."deployments"("id") ON DELETE no action ON UPDATE no action;