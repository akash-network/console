CREATE TABLE IF NOT EXISTS "staking_unbonding" (
  "transaction_event_id" uuid PRIMARY KEY NOT NULL,
  "height" integer NOT NULL CONSTRAINT "staking_unbonding_height_fkey" REFERENCES "block" ("height"),
  "type" varchar(255) NOT NULL,
  "delegator" varchar(255) NOT NULL,
  "validator" varchar(255) NOT NULL,
  "amount" numeric(30, 0) NOT NULL,
  "completion_time" timestamp with time zone,
  "creation_height" integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staking_unbonding_height" ON "staking_unbonding" USING btree ("height");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staking_unbonding_delegator" ON "staking_unbonding" USING btree ("delegator");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staking_unbonding_completion_time" ON "staking_unbonding" USING btree ("completion_time");
