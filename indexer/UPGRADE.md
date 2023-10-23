# Upgrade instructions

Some indexer updates changes the database schemas and an upgrade script must be run on the database to migrate the data before or after updating the indexer. Here is a list of those migrations. If a version is not listed here it means the indexer can be updated without any manual migration.

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
