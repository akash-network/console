CREATE TABLE IF NOT EXISTS "sink_transfer" (
  "height" integer NOT NULL CONSTRAINT "sink_transfer_height_fkey" REFERENCES "block" ("height"),
  "sequence" integer NOT NULL,
  "owner" varchar(255) NOT NULL,
  "recipient" varchar(255) NOT NULL,
  "amount" numeric(30, 0) NOT NULL,
  "status" varchar(255) NOT NULL,
  "has_void_order" boolean DEFAULT false NOT NULL,
  "status_height" integer NOT NULL CONSTRAINT "sink_transfer_status_height_fkey" REFERENCES "block" ("height"),
  CONSTRAINT "sink_transfer_pkey" PRIMARY KEY ("height", "sequence")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sink_transfer_owner" ON "sink_transfer" USING btree ("owner");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sink_transfer_amount" ON "sink_transfer" USING btree ("amount");
