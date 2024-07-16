CREATE TABLE IF NOT EXISTS "userSetting" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userId" varchar(255) NOT NULL,
	"username" varchar(255) NOT NULL,
	"email" varchar(255),
	"emailVerified" boolean DEFAULT false NOT NULL,
	"stripeCustomerId" varchar(255),
	"bio" text,
	"subscribedToNewsletter" boolean DEFAULT false NOT NULL,
	"youtubeUsername" varchar(255),
	"twitterUsername" varchar(255),
	"githubUsername" varchar(255)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_setting_username" ON "userSetting" USING btree ("username");