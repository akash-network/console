CREATE SCHEMA "cosmos";
--> statement-breakpoint
CREATE TABLE "cosmos"."blocks" (
	"height" bigint PRIMARY KEY NOT NULL,
	"datetime" timestamp with time zone NOT NULL,
	"hash" "bytea" NOT NULL,
	"parent_hash" "bytea",
	"proposer_address" text NOT NULL,
	"tx_count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indexer_state" (
	"stream" text PRIMARY KEY NOT NULL,
	"last_height" bigint NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cosmos"."message_types" (
	"id" "smallserial" PRIMARY KEY NOT NULL,
	"type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cosmos"."messages" (
	"height" bigint NOT NULL,
	"tx_index" integer NOT NULL,
	"index" integer NOT NULL,
	"type_id" smallint NOT NULL,
	"body" jsonb,
	CONSTRAINT "messages_height_tx_index_index_pk" PRIMARY KEY("height","tx_index","index")
);
--> statement-breakpoint
CREATE TABLE "cosmos"."transactions" (
	"height" bigint NOT NULL,
	"index" integer NOT NULL,
	"hash" "bytea" NOT NULL,
	"code" integer NOT NULL,
	"gas_used" bigint NOT NULL,
	"gas_wanted" bigint NOT NULL,
	"fee" jsonb NOT NULL,
	CONSTRAINT "transactions_height_index_pk" PRIMARY KEY("height","index")
);
--> statement-breakpoint
ALTER TABLE "cosmos"."messages" ADD CONSTRAINT "messages_type_id_message_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "cosmos"."message_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "message_types_type_idx" ON "cosmos"."message_types" USING btree ("type");--> statement-breakpoint
CREATE INDEX "messages_type_id_idx" ON "cosmos"."messages" USING btree ("type_id");--> statement-breakpoint
CREATE INDEX "transactions_hash_idx" ON "cosmos"."transactions" USING btree ("hash");