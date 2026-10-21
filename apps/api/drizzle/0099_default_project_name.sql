SET lock_timeout = '3s';--> statement-breakpoint
UPDATE "projects" AS "default_project"
SET "name" = 'default-project', "updated_at" = now()
WHERE "default_project"."is_default" = true
  AND "default_project"."name" = 'default'
  AND NOT EXISTS (
    SELECT 1 FROM "projects" AS "other_project"
    WHERE "other_project"."organization_id" = "default_project"."organization_id"
      AND "other_project"."deleted_at" IS NULL
      AND lower("other_project"."name") = 'default-project'
  );--> statement-breakpoint
RESET lock_timeout;
