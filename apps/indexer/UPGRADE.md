# Upgrade instructions

Some indexer updates change the database schemas and an upgrade script must be run on the database to migrate the data before or after updating the indexer. Here is a list of those migrations. If a version is not listed here it means the indexer can be updated without any manual migration.

**It is recommended to stop the indexer before running any migration script.**

## v1.9.1

Change the type of the messages's `amount` to allow larger values.
```
ALTER TABLE message
ALTER COLUMN "amount"
TYPE numeric(30,0)
USING "amount"::numeric(30,0);
```

## v1.9.0

Add tracking of persistent storage for providers.

```
ALTER TABLE "providerSnapshot" RENAME COLUMN "activeStorage" TO "activeEphemeralStorage";
ALTER TABLE "providerSnapshot" RENAME COLUMN "pendingStorage" TO "pendingEphemeralStorage";
ALTER TABLE "providerSnapshot" RENAME COLUMN "availableStorage" TO "availableEphemeralStorage";
ALTER TABLE "providerSnapshot"
    ADD COLUMN "activePersistentStorage" bigint,
    ADD COLUMN "pendingPersistentStorage" bigint,
    ADD COLUMN "availablePersistentStorage" bigint;
        
ALTER TABLE "provider"
  DROP COLUMN "deploymentCount",
  DROP COLUMN "leaseCount",
  DROP COLUMN "activeCPU",
  DROP COLUMN "activeGPU",
  DROP COLUMN "activeMemory",
  DROP COLUMN "activeStorage",
  DROP COLUMN "pendingCPU",
  DROP COLUMN "pendingGPU",
  DROP COLUMN "pendingMemory",
  DROP COLUMN "pendingStorage",
  DROP COLUMN "availableCPU",
  DROP COLUMN "availableGPU",
  DROP COLUMN "availableMemory",
  DROP COLUMN "availableStorage";

CREATE TABLE IF NOT EXISTS "providerSnapshotStorage"
(
    id uuid NOT NULL,
    "snapshotId" uuid NOT NULL,
    class character varying(255) COLLATE pg_catalog."default" NOT NULL,
    "allocatable" bigint NOT NULL,
    "allocated" bigint NOT NULL,
    CONSTRAINT "providerSnapshotStorage_pkey" PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS provider_snapshot_storage_snapshot_id
    ON public."providerSnapshotStorage" USING btree
    ("snapshotId" ASC NULLS LAST)
    WITH (deduplicate_items=True)
    TABLESPACE pg_default;

```

## v1.8.2

Change the type of the lease's `predictedClosedHeight` to allow larger values.
```
ALTER TABLE lease
ALTER COLUMN "predictedClosedHeight"
TYPE numeric(30,0)
USING "predictedClosedHeight"::numeric(30,0);
```

## v1.8.0

Version 1.8.0 adds the necessary fields for improving the Akash provider uptime checks.

```
ALTER TABLE IF EXISTS public.provider
    ADD COLUMN "nextCheckDate" timestamp with time zone NOT NULL DEFAULT NOW(),
    ADD COLUMN "failedCheckCount" integer DEFAULT 0,
    ADD COLUMN "lastSuccessfulSnapshotId" uuid,
    ADD COLUMN "downtimeFirstSnapshotId" uuid;

-- Set lastSuccessfulSnapshotId on providers
WITH last_successful_snapshots AS (
	SELECT DISTINCT ON(p.owner) p.owner, ps.id AS "snapshotId"
	FROM provider p
	INNER JOIN "providerSnapshot" ps ON p.owner=ps.owner AND ps."isOnline" IS TRUE
	ORDER BY p.owner, ps."checkDate" DESC
)
UPDATE provider p
SET "lastSuccessfulSnapshotId"=last_successful_snapshots."snapshotId"
FROM last_successful_snapshots
WHERE p.owner=last_successful_snapshots.owner;

-- Set downtimeFirstSnapshotId on providers
WITH downtime_first_snapshot AS (
	SELECT 
	p."owner",
	(
		SELECT "id" 
		FROM "providerSnapshot" ps 
		WHERE 
			ps.owner=p.owner 
			AND ps."isOnline" IS FALSE 
			AND (
				"lastSuccessfulSnapshot".id IS NULL 
				OR ps."checkDate" > "lastSuccessfulSnapshot"."checkDate")
		ORDER BY ps."checkDate" ASC
		LIMIT 1
	) AS "downtimeFirstSnapshotId"
	FROM provider p
	LEFT JOIN "providerSnapshot" "lastSuccessfulSnapshot" ON "lastSuccessfulSnapshot".id=p."lastSuccessfulSnapshotId"
	WHERE p."isOnline" IS FALSE
)
UPDATE provider 
SET "downtimeFirstSnapshotId"=downtime_first_snapshot."downtimeFirstSnapshotId"
FROM downtime_first_snapshot
WHERE provider.owner=downtime_first_snapshot.owner;

-- Spread providers "nextCheckDate" evenly accross a 15 minute window
UPDATE provider SET "nextCheckDate"=NOW() + interval '1 second' * (random() * 15 * 60);

ALTER TABLE IF EXISTS public."providerSnapshot"
    ADD COLUMN "isLastSuccessOfDay" boolean NOT NULL DEFAULT false;

-- Set isLastSuccessOfDay to true for successful snapshots that are the last of each day for every providers
WITH last_successful_snapshots AS (
	SELECT DISTINCT ON(ps."owner",DATE("checkDate")) DATE("checkDate") AS date, ps."id" AS "psId"
	FROM "providerSnapshot" ps
	WHERE "isOnline" = TRUE
	ORDER BY ps."owner",DATE("checkDate"),"checkDate" DESC
)
UPDATE "providerSnapshot" AS ps
SET "isLastSuccessOfDay" = TRUE
FROM last_successful_snapshots AS ls
WHERE ls."psId"=ps.id;

CREATE INDEX IF NOT EXISTS provider_snapshot_id_where_islastsuccessofday
    ON public."providerSnapshot" USING btree
    (id ASC NULLS LAST)
    TABLESPACE pg_default
    WHERE "isLastSuccessOfDay" = true;
```

## v1.7.1

Storing cpu vcores as numbers instead of strings

```
ALTER TABLE IF EXISTS public."providerSnapshotNodeCPU"
    ALTER COLUMN vcores TYPE smallint USING vcores::smallint;
```

## v1.7.0

Version 1.7.0 adds some tables and fields to improve provider queries as well as keep track of node/cpu/gpu data provided by the new status endpoint (grpc).

```
-- Add new Provider columns
ALTER TABLE IF EXISTS public.provider
    ADD COLUMN "lastSnapshotId" uuid;

-- Set lastSnapshotId to the most recent snapshot for each providers
UPDATE "provider" p SET "lastSnapshotId" = (
	SELECT ps.id FROM "providerSnapshot" ps WHERE ps."owner" = p."owner" ORDER BY "checkDate" DESC LIMIT 1
);

-- Update ProviderSnapshot schemas
ALTER TABLE IF EXISTS public."providerSnapshot"
    ADD COLUMN "isLastOfDay" boolean NOT NULL DEFAULT false,
	ALTER COLUMN "isOnline" SET NOT NULL,
	ALTER COLUMN "checkDate" SET NOT NULL;

-- Set isLastOfDay to true for snapshots that are the last of each day for every providers
WITH last_snapshots AS (
	SELECT DISTINCT ON(ps."owner",DATE("checkDate")) DATE("checkDate") AS date, ps."id" AS "psId"
	FROM "providerSnapshot" ps
	ORDER BY ps."owner",DATE("checkDate"),"checkDate" DESC
)
UPDATE "providerSnapshot" AS ps
SET "isLastOfDay" = TRUE
FROM last_snapshots AS ls
WHERE ls."psId"=ps.id;

-- Add index for isLastofDay
CREATE INDEX IF NOT EXISTS provider_snapshot_id_where_isonline_and_islastofday
    ON public."providerSnapshot" USING btree
    (id ASC NULLS LAST)
    TABLESPACE pg_default
    WHERE "isOnline" = true AND "isLastOfDay" = true;

-- Create new tables for tracking nodes/gpu/cpu info
CREATE TABLE IF NOT EXISTS public."providerSnapshotNode"
(
    id uuid NOT NULL,
    "snapshotId" uuid NOT NULL,
    name character varying(255) COLLATE pg_catalog."default",
    "cpuAllocatable" bigint,
    "cpuAllocated" bigint,
    "memoryAllocatable" bigint,
    "memoryAllocated" bigint,
    "ephemeralStorageAllocatable" bigint,
    "ephemeralStorageAllocated" bigint,
    "capabilitiesStorageHDD" boolean,
    "capabilitiesStorageSSD" boolean,
    "capabilitiesStorageNVME" boolean,
    "gpuAllocatable" bigint,
    "gpuAllocated" bigint,
    CONSTRAINT "providerSnapshotNode_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."providerSnapshotNodeCPU"
(
    id uuid NOT NULL,
    "snapshotNodeId" uuid NOT NULL,
    vendor character varying(255) COLLATE pg_catalog."default",
    model character varying(255) COLLATE pg_catalog."default",
    vcores character varying(255) COLLATE pg_catalog."default",
    CONSTRAINT "providerSnapshotNodeCPU_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."providerSnapshotNodeGPU"
(
    id uuid NOT NULL,
    "snapshotNodeId" uuid NOT NULL,
    vendor character varying(255) COLLATE pg_catalog."default",
    name character varying(255) COLLATE pg_catalog."default",
    "modelId" character varying(255) COLLATE pg_catalog."default",
    interface character varying(255) COLLATE pg_catalog."default",
    "memorySize" character varying(255) COLLATE pg_catalog."default",
    CONSTRAINT "providerSnapshotNodeGPU_pkey" PRIMARY KEY (id)
);
```

## v1.5.0

Version 1.5.0 adds an `updatedHeight` field to Akash's `Provider` table and fixes a bug that was updating the `createdHeight` on provider updates. This script need to be run before updating the indexer to v1.5.0.

```
-- Add updatedHeight column to provider table
ALTER TABLE IF EXISTS "provider" ADD COLUMN "updatedHeight" integer;

-- Set correct values for createdHeight and updatedHeight
WITH "created_msg" AS (
	SELECT m."height",ar."address"
	FROM "message" m
	INNER JOIN "transaction" t ON t.id=m."txId"
	INNER JOIN "addressReference" ar ON ar."transactionId"=t."id"
	WHERE t."hasProcessingError" IS FALSE AND m."type" LIKE '/akash.provider.%.MsgCreateProvider' AND ar."type"='Signer'
),
"update_msg" AS (
	SELECT MAX(m."height") AS "height",ar."address"
	FROM "message" m
	INNER JOIN "transaction" t ON t.id=m."txId"
	INNER JOIN "addressReference" ar ON ar."transactionId"=t."id"
	WHERE t."hasProcessingError" IS FALSE AND m."type" LIKE '/akash.provider.%.MsgUpdateProvider' AND ar."type"='Signer'
	GROUP BY ar."address"
)
UPDATE "provider" p
SET "createdHeight"=cm."height", "updatedHeight"=um."height"
FROM "created_msg" cm
LEFT JOIN "update_msg" um ON um."address"=cm."address"
WHERE cm."address"=p."owner";
```
