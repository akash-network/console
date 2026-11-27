CREATE TYPE "public"."funding_wallet_refund_status" AS ENUM('pending', 'crediting', 'credited', 'failed');--> statement-breakpoint
CREATE TABLE "funding_wallet_refunds" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"move_id" uuid NOT NULL,
	"tx_hash" varchar(64) NOT NULL,
	"msg_index" integer NOT NULL,
	"amount" bigint NOT NULL,
	"status" "funding_wallet_refund_status" NOT NULL,
	"failure" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "funding_wallet_refunds" ADD CONSTRAINT "funding_wallet_refunds_move_id_funding_wallet_moves_id_fk" FOREIGN KEY ("move_id") REFERENCES "public"."funding_wallet_moves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "funding_wallet_refunds_move_message_unique" ON "funding_wallet_refunds" USING btree ("move_id","tx_hash","msg_index");