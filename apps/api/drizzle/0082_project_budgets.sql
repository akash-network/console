SET lock_timeout = '3s';--> statement-breakpoint
CREATE TABLE "project_budgets" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"monthly_amount_cents" integer NOT NULL,
	"alert_threshold_percent" smallint DEFAULT 80 NOT NULL,
	"stop_top_ups" boolean DEFAULT false NOT NULL,
	"alerted_for_period" date,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_budgets_organization_id_project_id_unique" UNIQUE("organization_id","project_id")
);
--> statement-breakpoint
ALTER TABLE "project_budgets" ADD CONSTRAINT "project_budgets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budgets" ADD CONSTRAINT "project_budgets_created_by_user_id_userSetting_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."userSetting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budgets" ADD CONSTRAINT "project_budgets_organization_id_project_id_fk" FOREIGN KEY ("organization_id","project_id") REFERENCES "public"."projects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
RESET lock_timeout;
