DO $$ BEGIN
 CREATE TYPE "public"."stripe_transaction_status" AS ENUM('created', 'pending', 'requires_action', 'succeeded', 'failed', 'refunded', 'canceled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."stripe_transaction_type" AS ENUM('payment_intent', 'coupon_claim');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stripe_transactions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "stripe_transaction_type" NOT NULL,
	"status" "stripe_transaction_status" DEFAULT 'created' NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'usd' NOT NULL,
	"stripe_payment_intent_id" varchar(255),
	"stripe_charge_id" varchar(255),
	"stripe_coupon_id" varchar(255),
	"stripe_promotion_code_id" varchar(255),
	"stripe_invoice_id" varchar(255),
	"payment_method_type" varchar(50),
	"card_brand" varchar(50),
	"card_last4" varchar(4),
	"receipt_url" varchar(2048),
	"description" varchar(500),
	"error_message" varchar(1000),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "checkout_sessions";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stripe_transactions" ADD CONSTRAINT "stripe_transactions_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_transactions_user_id_idx" ON "stripe_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_transactions_stripe_payment_intent_id_idx" ON "stripe_transactions" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_transactions_stripe_charge_id_idx" ON "stripe_transactions" USING btree ("stripe_charge_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_transactions_stripe_coupon_id_idx" ON "stripe_transactions" USING btree ("stripe_coupon_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_transactions_stripe_promotion_code_id_idx" ON "stripe_transactions" USING btree ("stripe_promotion_code_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_transactions_status_idx" ON "stripe_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_transactions_created_at_idx" ON "stripe_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_transactions_user_id_created_at_idx" ON "stripe_transactions" USING btree ("user_id","created_at");