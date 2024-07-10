CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"address" varchar,
	"stripe_customer_id" varchar,
	"deployment_allowance" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"fee_allowance" numeric(10, 2) DEFAULT '0.00' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "userSetting" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"userId" varchar(255),
	"username" varchar(255),
	"email" varchar(255),
	"emailVerified" boolean DEFAULT false NOT NULL,
	"stripeCustomerId" varchar(255),
	"bio" text,
	"subscribedToNewsletter" boolean DEFAULT false NOT NULL,
	"youtubeUsername" varchar(255),
	"twitterUsername" varchar(255),
	"githubUsername" varchar(255),
	CONSTRAINT "userSetting_userId_unique" UNIQUE("userId"),
	CONSTRAINT "userSetting_username_unique" UNIQUE("username")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
