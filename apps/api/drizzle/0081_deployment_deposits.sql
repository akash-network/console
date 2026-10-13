SET lock_timeout = '3s';--> statement-breakpoint
CREATE TYPE "public"."deployment_deposit_kind" AS ENUM('deployment_create', 'top_up');--> statement-breakpoint
CREATE TYPE "public"."deployment_deposit_status" AS ENUM('pending', 'confirmed', 'void');--> statement-breakpoint
CREATE TABLE "deployment_deposits" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"owner" varchar(128) NOT NULL,
	"dseq" varchar(64) NOT NULL,
	"kind" "deployment_deposit_kind" NOT NULL,
	"amount" numeric(30, 0) NOT NULL,
	"denom" varchar(128) NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" "deployment_deposit_status" DEFAULT 'pending' NOT NULL,
	"tx_hash" varchar(64),
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deployment_deposits" ADD CONSTRAINT "deployment_deposits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_deposits" ADD CONSTRAINT "deployment_deposits_actor_user_id_userSetting_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."userSetting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_deposits" ADD CONSTRAINT "deployment_deposits_organization_id_project_id_fk" FOREIGN KEY ("organization_id","project_id") REFERENCES "public"."projects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deployment_deposits_organization_id_created_at_idx" ON "deployment_deposits" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "deployment_deposits_organization_id_project_id_created_at_idx" ON "deployment_deposits" USING btree ("organization_id","project_id","created_at");--> statement-breakpoint
CREATE INDEX "deployment_deposits_pending_tx_hash_idx" ON "deployment_deposits" USING btree ("tx_hash") WHERE "deployment_deposits"."status" = 'pending' AND "deployment_deposits"."tx_hash" IS NOT NULL;--> statement-breakpoint
RESET lock_timeout;
