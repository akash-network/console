SET lock_timeout = '3s';--> statement-breakpoint
CREATE TABLE "template_publishers" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"handle" varchar(64) NOT NULL,
	"bio" varchar(300),
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"publishing_suspended_at" timestamp with time zone,
	"publishing_suspended_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "template_publishers_handle_unique" UNIQUE("handle"),
	CONSTRAINT "template_publishers_handle_format" CHECK ("template_publishers"."handle" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "template_terms_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"template_id" uuid NOT NULL,
	"user_id" uuid,
	"organization_id" uuid NOT NULL,
	"terms_version" varchar(16) NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "template_publishers" ADD CONSTRAINT "template_publishers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_terms_acceptances" ADD CONSTRAINT "template_terms_acceptances_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_terms_acceptances" ADD CONSTRAINT "template_terms_acceptances_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_terms_acceptances" ADD CONSTRAINT "template_terms_acceptances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "template_terms_acceptances_template_id_idx" ON "template_terms_acceptances" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "template_terms_acceptances_user_id_accepted_at_idx" ON "template_terms_acceptances" USING btree ("user_id","accepted_at");--> statement-breakpoint
CREATE INDEX "template_terms_acceptances_organization_id_accepted_at_idx" ON "template_terms_acceptances" USING btree ("organization_id","accepted_at");--> statement-breakpoint
CREATE INDEX "template_author_id_created_at_idx" ON "template" USING btree ("author_id","created_at");--> statement-breakpoint
CREATE INDEX "template_versions_created_by_id_created_at_idx" ON "template_versions" USING btree ("created_by_id","created_at");--> statement-breakpoint
RESET lock_timeout;
