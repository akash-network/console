CREATE TYPE "public"."refund_debit_status" AS ENUM('pending', 'landed');--> statement-breakpoint
CREATE TABLE "refund_debits" (
	"transaction_id" uuid NOT NULL,
	"amount_refunded" integer NOT NULL,
	"status" "refund_debit_status" DEFAULT 'pending' NOT NULL,
	"address" varchar(255) NOT NULL,
	"amount" integer NOT NULL,
	"tx_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refund_debits_transaction_id_amount_refunded_pk" PRIMARY KEY("transaction_id","amount_refunded")
);
--> statement-breakpoint
ALTER TABLE "refund_debits" ADD CONSTRAINT "refund_debits_transaction_id_stripe_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."stripe_transactions"("id") ON DELETE cascade ON UPDATE no action;