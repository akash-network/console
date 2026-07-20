CREATE TYPE "public"."x402_transaction_status" AS ENUM('pending', 'settled', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "x402_transactions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "x402_transaction_status" DEFAULT 'pending' NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'usd' NOT NULL,
	"network" varchar(100) NOT NULL,
	"asset" varchar(255) NOT NULL,
	"payment_hash" varchar(64) NOT NULL,
	"payer_address" varchar(255),
	"settlement_tx_hash" varchar(255),
	"error_message" varchar(1000),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "x402_transactions" ADD CONSTRAINT "x402_transactions_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "x402_transactions_payment_hash_unique" ON "x402_transactions" USING btree ("payment_hash");--> statement-breakpoint
CREATE INDEX "x402_transactions_user_id_idx" ON "x402_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "x402_transactions_status_idx" ON "x402_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "x402_transactions_user_id_created_at_idx" ON "x402_transactions" USING btree ("user_id","created_at");