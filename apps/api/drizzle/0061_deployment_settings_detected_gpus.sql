ALTER TABLE "deployment_settings" ADD COLUMN "detected_gpus" jsonb;--> statement-breakpoint
UPDATE "deployment_settings" AS "setting"
SET "detected_gpus" = "reading"."entries"
FROM (
  SELECT
    "user_id",
    "dseq",
    jsonb_agg(
      jsonb_build_object(
        'gseq', "gseq",
        'oseq', "oseq",
        'provider', "provider",
        'service', "service",
        'gpus', "gpus",
        'driverVersion', "driver_version",
        'source', "source",
        'detectedAt', to_char("detected_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
      ORDER BY "gseq", "oseq", "provider", "service"
    ) AS "entries"
  FROM "lease_gpus"
  GROUP BY "user_id", "dseq"
) AS "reading"
WHERE "setting"."user_id" = "reading"."user_id" AND "setting"."dseq" = "reading"."dseq";
