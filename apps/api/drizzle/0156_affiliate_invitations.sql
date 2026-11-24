CREATE TABLE "affiliate_invitations" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "affiliate_invitations" ADD CONSTRAINT "affiliate_invitations_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE cascade ON UPDATE no action;