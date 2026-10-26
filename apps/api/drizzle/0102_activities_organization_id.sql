SET lock_timeout = '3s';--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
CREATE INDEX "activities_organization_id_idx" ON "activities" USING btree ("organization_id") WHERE "activities"."organization_id" IS NOT NULL;--> statement-breakpoint
UPDATE "activities"
SET "organization_id" = "organizations"."id"
FROM "organizations"
WHERE "activities"."organization_id" IS NULL
  AND "organizations"."type" = 'team'
  AND "organizations"."deleted_at" IS NULL
  AND "organizations"."id"::text = "activities"."meta"->>'organizationId';--> statement-breakpoint
UPDATE "activities"
SET "organization_id" = "team_deployment"."organization_id"
FROM (
  SELECT "activities"."id", (array_agg("deployment_settings"."organization_id"))[1] AS "organization_id"
  FROM "activities"
  JOIN "deployment_settings" ON "deployment_settings"."dseq" = "activities"."meta"->>'dseq'
  LEFT JOIN "organizations" ON "organizations"."id" = "deployment_settings"."organization_id" AND "organizations"."deleted_at" IS NULL
  WHERE "activities"."organization_id" IS NULL
    AND (
      "deployment_settings"."user_id" = "activities"."user_id"
      OR EXISTS (
        SELECT 1 FROM "organization_members"
        WHERE "organization_members"."organization_id" = "deployment_settings"."organization_id"
          AND "organization_members"."user_id" = "activities"."user_id"
      )
    )
  GROUP BY "activities"."id"
  HAVING count(*) = 1 AND bool_and(coalesce("organizations"."type" = 'team', false))
) AS "team_deployment"
WHERE "activities"."id" = "team_deployment"."id";--> statement-breakpoint
RESET lock_timeout;
