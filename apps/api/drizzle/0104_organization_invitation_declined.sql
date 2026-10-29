ALTER TYPE "public"."organization_invitation_status" ADD VALUE 'declined';--> statement-breakpoint
ALTER TYPE "public"."organization_activity_type" ADD VALUE 'invitation_declined';--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD COLUMN "declined_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "organization_invitations_email_pending_idx" ON "organization_invitations" USING btree ("email") WHERE "organization_invitations"."status" = 'pending';