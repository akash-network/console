SET lock_timeout = '3s';--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
CREATE INDEX "activities_organization_id_idx" ON "activities" USING btree ("organization_id") WHERE "activities"."organization_id" IS NOT NULL;--> statement-breakpoint
UPDATE "activities"
SET "organization_id" = "organizations"."id"
FROM "organizations"
WHERE "activities"."organization_id" IS NULL
  AND "organizations"."type" = 'team'
  AND "organizations"."id"::text = "activities"."meta"->>'organizationId';--> statement-breakpoint
UPDATE "activities"
SET "organization_id" = "deployment_settings"."organization_id"
FROM "deployment_settings"
JOIN "organizations" ON "organizations"."id" = "deployment_settings"."organization_id" AND "organizations"."type" = 'team'
WHERE "activities"."organization_id" IS NULL
  AND "deployment_settings"."dseq" = "activities"."meta"->>'dseq';--> statement-breakpoint
RESET lock_timeout;
