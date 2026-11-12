SET lock_timeout = '3s';--> statement-breakpoint
INSERT INTO "template_versions" ("template_id", "version", "sdl", "created_by_id")
SELECT t."id", 1, t."sdl", u."id"
FROM "template" t
LEFT JOIN "userSetting" u ON u."userId" = t."userId"
WHERE NOT EXISTS (SELECT 1 FROM "template_versions" v WHERE v."template_id" = t."id")
ON CONFLICT ("template_id", "version") DO NOTHING;--> statement-breakpoint
INSERT INTO "template_versions" ("template_id", "version", "sdl", "created_by_id")
SELECT t."id", latest."version" + 1, t."sdl", u."id"
FROM "template" t
JOIN LATERAL (
  SELECT v."version", v."sdl" FROM "template_versions" v WHERE v."template_id" = t."id" ORDER BY v."version" DESC LIMIT 1
) latest ON true
LEFT JOIN "userSetting" u ON u."userId" = t."userId"
WHERE latest."sdl" IS DISTINCT FROM t."sdl"
ON CONFLICT ("template_id", "version") DO NOTHING;--> statement-breakpoint
UPDATE "template" t SET "current_version_id" = latest."id"
FROM (
  SELECT DISTINCT ON (v."template_id") v."template_id", v."id", observed."current_version_id" AS "observed_current_version_id"
  FROM "template_versions" v
  JOIN "template" observed ON observed."id" = v."template_id"
  ORDER BY v."template_id", v."version" DESC
) latest
WHERE latest."template_id" = t."id"
  AND t."current_version_id" IS DISTINCT FROM latest."id"
  AND t."current_version_id" IS NOT DISTINCT FROM latest."observed_current_version_id";--> statement-breakpoint
UPDATE "template" t SET "author_id" = u."id"
FROM "userSetting" u
WHERE t."author_id" IS NULL AND u."userId" = t."userId";--> statement-breakpoint
UPDATE "template"
SET "visibility" = CASE WHEN "isPublic" THEN 'public'::"template_visibility" ELSE 'private'::"template_visibility" END, "listed" = NOT "isPublic"
WHERE "isPublic" <> ("visibility" = 'public');--> statement-breakpoint
RESET lock_timeout;
