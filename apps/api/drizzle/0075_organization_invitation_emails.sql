CREATE TABLE "organization_invitation_emails" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invitation_id" uuid NOT NULL,
	"sent_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_invitation_emails" ADD CONSTRAINT "organization_invitation_emails_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitation_emails" ADD CONSTRAINT "organization_invitation_emails_invitation_id_organization_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."organization_invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitation_emails" ADD CONSTRAINT "organization_invitation_emails_sent_by_user_id_userSetting_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."userSetting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_invitation_emails_organization_id_created_at_idx" ON "organization_invitation_emails" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "organization_invitation_emails_sent_by_user_id_created_at_idx" ON "organization_invitation_emails" USING btree ("sent_by_user_id","created_at");--> statement-breakpoint
CREATE INDEX "organization_invitation_emails_invitation_id_idx" ON "organization_invitation_emails" USING btree ("invitation_id");