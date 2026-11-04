SET lock_timeout = '3s';--> statement-breakpoint
CREATE TYPE "public"."hardware_request_source" AS ENUM('reserve_capacity', 'configure_reserve', 'no_fit', 'no_bids', 'gpu_menu', 'requests_page');--> statement-breakpoint
CREATE TYPE "public"."hardware_request_status" AS ENUM('submitted', 'in_review', 'sourcing', 'offers', 'accepted', 'fulfilled', 'withdrawn', 'closed');--> statement-breakpoint
ALTER TYPE "public"."hardware_request_category" ADD VALUE 'quote';--> statement-breakpoint
ALTER TABLE "hardware_requests" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "hardware_requests" ADD COLUMN "status" "hardware_request_status" DEFAULT 'submitted' NOT NULL;--> statement-breakpoint
ALTER TABLE "hardware_requests" ADD COLUMN "source" "hardware_request_source";--> statement-breakpoint
ALTER TABLE "hardware_requests" ADD COLUMN "spec" jsonb;--> statement-breakpoint
ALTER TABLE "hardware_requests" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "hardware_requests" ADD CONSTRAINT "hardware_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
CREATE INDEX "hardware_requests_organization_id_created_at_idx" ON "hardware_requests" USING btree ("organization_id","created_at");--> statement-breakpoint
UPDATE "hardware_requests"
SET "organization_id" = "organizations"."id", "updated_at" = "hardware_requests"."created_at"
FROM "organizations"
WHERE "hardware_requests"."organization_id" IS NULL
  AND "organizations"."type" = 'personal'
  AND "organizations"."created_by_user_id" = "hardware_requests"."user_id";--> statement-breakpoint
RESET lock_timeout;
