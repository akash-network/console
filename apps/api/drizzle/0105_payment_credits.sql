CREATE TYPE "public"."payment_credit_status" AS ENUM('pending', 'landed');--> statement-breakpoint
CREATE TABLE "payment_credits" (
	"transaction_id" uuid PRIMARY KEY NOT NULL,
	"status" "payment_credit_status" DEFAULT 'pending' NOT NULL,
	"address" varchar(255) NOT NULL,
	"amount" integer NOT NULL,
	"tx_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_credits" ADD CONSTRAINT "payment_credits_transaction_id_stripe_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."stripe_transactions"("id") ON DELETE cascade ON UPDATE no action;