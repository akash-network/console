CREATE TABLE "first_purchase_bonus_win_backs" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "first_purchase_bonus_win_backs" ADD CONSTRAINT "first_purchase_bonus_win_backs_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE cascade ON UPDATE no action;