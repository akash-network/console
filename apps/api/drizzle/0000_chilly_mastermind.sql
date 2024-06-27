CREATE TABLE IF NOT EXISTS "user_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"address" varchar,
	"stripe_customer_id" varchar,
	"credit_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL
);
