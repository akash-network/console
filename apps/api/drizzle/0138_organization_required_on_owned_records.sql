SET lock_timeout = '3s';--> statement-breakpoint
ALTER TABLE "user_wallets" VALIDATE CONSTRAINT "user_wallets_organization_id_organizations_id_fk";--> statement-breakpoint
ALTER TABLE "wallet_settings" VALIDATE CONSTRAINT "wallet_settings_organization_id_organizations_id_fk";--> statement-breakpoint
ALTER TABLE "payment_methods" VALIDATE CONSTRAINT "payment_methods_organization_id_organizations_id_fk";--> statement-breakpoint
ALTER TABLE "stripe_transactions" VALIDATE CONSTRAINT "stripe_transactions_organization_id_organizations_id_fk";--> statement-breakpoint
ALTER TABLE "template" VALIDATE CONSTRAINT "template_organization_id_organizations_id_fk";--> statement-breakpoint
ALTER TABLE "template" VALIDATE CONSTRAINT "template_organization_id_project_id_fk";--> statement-breakpoint
ALTER TABLE "deployment_settings" VALIDATE CONSTRAINT "deployment_settings_organization_id_organizations_id_fk";--> statement-breakpoint
ALTER TABLE "deployment_settings" VALIDATE CONSTRAINT "deployment_settings_organization_id_project_id_fk";--> statement-breakpoint
ALTER TABLE "api_keys" VALIDATE CONSTRAINT "api_keys_organization_id_organizations_id_fk";--> statement-breakpoint
ALTER TABLE "api_keys" VALIDATE CONSTRAINT "api_keys_organization_id_project_id_fk";--> statement-breakpoint
ALTER TABLE "payment_methods" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stripe_transactions" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "wallet_settings" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "template" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "deployment_settings" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_organization_id_required_while_owned" CHECK ("user_wallets"."organization_id" IS NOT NULL OR "user_wallets"."user_id" IS NULL);--> statement-breakpoint
RESET lock_timeout;
