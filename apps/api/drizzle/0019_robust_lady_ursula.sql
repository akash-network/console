CREATE TABLE IF NOT EXISTS "stripe_transactions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"stripe_transaction_id" varchar(255) NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" text NOT NULL,
	"currency" varchar(10) NOT NULL,
	"status" varchar(50) NOT NULL,
	"description" text,
	"metadata" jsonb,
	"stripe_created_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_transactions_stripe_transaction_id_unique" UNIQUE("stripe_transaction_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stripe_coupons" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"stripe_coupon_id" varchar(255) NOT NULL,
	"user_id" uuid NOT NULL,
	"coupon_code" varchar(255),
	"discount_amount" text,
	"stripe_created_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_coupons_stripe_coupon_id_unique" UNIQUE("stripe_coupon_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stripe_transactions" ADD CONSTRAINT "stripe_transactions_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stripe_coupons" ADD CONSTRAINT "stripe_coupons_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
