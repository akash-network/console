CREATE TABLE "configure_drafts" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"draft_id" varchar(64) NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "configure_drafts" ADD CONSTRAINT "configure_drafts_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "configure_drafts_user_id_draft_id_idx" ON "configure_drafts" USING btree ("user_id","draft_id");--> statement-breakpoint
CREATE INDEX "configure_drafts_user_id_updated_at_idx" ON "configure_drafts" USING btree ("user_id","updated_at");