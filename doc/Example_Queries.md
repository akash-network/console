# Example Queries

- [Daily New Leases (Last 30 Days)](#daily-new-leases-last-30-days)
- [Daily New Leases **using Persistent Storage** (Last 30 Days)](#daily-new-leases-using-persistent-storage-last-30-days)
- [Daily New Users (Last 30 Days)](#daily-new-users-last-30-days)
- [Top 10 providers with the most active leases](#top-10-providers-with-the-most-active-leases)
- [Top 10 wallets with the most leases (All-Time)](#top-10-wallets-with-the-most-leases-all-time)
- [Top 10 wallets with the most **active leases**](#top-10-wallets-with-the-most-active-leases)
- [Leases that are overdrawn, but not closed yet](#leases-that-are-overdrawn-but-not-closed-yet)
- [Providers per Country](#providers-per-country)
- [Top 10 providers with the most CPU](#top-10-providers-with-the-most-cpu)
- [Network Capacity (CPU) over time (Last 30 Days)](#network-capacity-cpu-over-time-last-30-days)
- [Top 10 largest AKT transfers in the last 7 days](#top-10-largest-akt-transfers-in-the-last-7-days)
- [Get all messages related to a deployment](#get-all-messages-related-to-a-deployment)

## Daily New Leases (Last 30 Days)

```
SELECT "day"."date", COUNT(*)
FROM "lease"
INNER JOIN "block" ON "block"."height" = "lease"."createdHeight"
INNER JOIN "day" ON "day"."id" = "block"."dayId"
GROUP BY "day"."date"
ORDER BY "day"."date" DESC
LIMIT 30
```
![Daily New Leases (Last 30 Days)](./daily-new-leases-last-30-days.png)

## Daily New Leases **using Persistent Storage** (Last 30 Days)

```
SELECT "day"."date", COUNT("lease"."id")
FROM "lease"
INNER JOIN "block" ON "block"."height" = "lease"."createdHeight"
INNER JOIN "day" ON "day"."id" = "block"."dayId"
WHERE "lease"."persistentStorageQuantity" > 0
GROUP BY "day"."date"
ORDER BY "day"."date" DESC
LIMIT 30
```
![Daily New Leases **using Persistent Storage** (Last 30 Days)](./daily-new-leases-using-persistent-storage-last-30-days.png)

## Daily New Users (Last 30 Days)

```
WITH "Addresses" AS (
    SELECT 
        l."owner" AS "Address",
        MIN(b."datetime") AS "FirstDeployDate"
    FROM "lease" l
    INNER JOIN "block" b ON b.height = l."createdHeight"
    GROUP BY l."owner"
)
SELECT
    DATE("FirstDeployDate") AS "Date",
    COUNT(*) AS "New Address Count"
FROM "Addresses" AS d
GROUP BY DATE("FirstDeployDate")
ORDER BY DATE("FirstDeployDate") DESC
LIMIT 30
```
![Daily New Users (Last 30 Days)](./daily-new-users-last-30-days.png)

## Top 10 providers with the most active leases

```
SELECT "provider"."owner", "provider"."hostUri", COUNT(*) 
FROM provider
INNER JOIN "lease" ON "lease"."providerAddress" = provider."owner"
WHERE "lease"."closedHeight" IS NULL
GROUP BY "provider"."owner"
ORDER BY COUNT(*) DESC
LIMIT 10
```
![Top 10 providers with the most active leases](./top-10-providers-with-the-most-active-leases.png)

## Top 10 wallets with the most leases (All-Time)

```
SELECT "owner", COUNT(*) 
FROM lease
GROUP BY "lease"."owner"
ORDER BY COUNT(*) DESC
LIMIT 10
```
![Top 10 wallets with the most leases (All-Time)](./top-10-wallets-with-the-most-leases-all-time.png)

## Top 10 wallets with the most **active leases**

```
SELECT "owner", COUNT(*) 
FROM lease
WHERE "lease"."closedHeight" IS NULL
GROUP BY "lease"."owner"
ORDER BY COUNT(*) DESC
LIMIT 10
```
![Top 10 wallets with the most **active leases**](./top-10-wallets-with-the-most-active-leases.png)

## Leases that are overdrawn, but not closed yet

```
SELECT owner,dseq,"providerAddress"
FROM lease
WHERE "closedHeight" IS NULL AND "predictedClosedHeight" < (SELECT MAX(height) FROM block)
```
![Leases that are overdrawn, but not closed yet](./leases-that-are-overdrawn,-but-not-closed-yet.png)

## Providers per Country

```
SELECT "ipCountry", COUNT(*)
FROM provider
WHERE "isOnline" IS TRUE
GROUP BY "ipCountry"
ORDER BY COUNT(*) DESC
```
![Providers per Country](./providers-per-country.png)

## Top 10 providers with the most CPU

```
SELECT owner,"hostUri", ("activeCPU" + "pendingCPU" + "availableCPU") / 1000 AS "Total CPU"
FROM provider
WHERE "isOnline" IS TRUE
ORDER BY ("activeCPU" + "pendingCPU" + "availableCPU") / 1000 DESC
LIMIT 10
```
![Top 10 providers with the most CPU](./top-10-providers-with-the-most-cpu.png)

## Network Capacity (CPU) over time (Last 30 Days)

```
WITH daily_last_snapshot AS (
    SELECT owner, date("checkDate") as day, MAX("checkDate") as last_check_date
    FROM public."providerSnapshot"
  WHERE "isOnline" IS TRUE
    GROUP BY owner, day
)
SELECT 
  dls."day" AS "Day", 
  ROUND(SUM(ps."activeCPU"+ps."pendingCPU"+ps."availableCPU") / 1000) AS "Total CPU"
FROM public."providerSnapshot" ps
JOIN daily_last_snapshot dls ON dls.owner = ps.owner AND dls.last_check_date = ps."checkDate"
GROUP BY dls."day"
ORDER BY dls."day" DESC
LIMIT 30
```
![Network Capacity (CPU) over time (Last 30 Days)](./network-capacity-cpu-over-time-last-30-days.png)

## Top 10 largest AKT transfers in the last 7 days

```
SELECT 
    "message"."height", 
    "transaction"."hash", 
    "amount" / 1000000 AS "AKT Amount", 
    "amount" / 1000000 * "day"."aktPrice" AS "USD Amount"
FROM "message"
INNER JOIN "block" ON "block".height = "message".height
INNER JOIN "transaction" ON "transaction"."id" = "message"."txId"
INNER JOIN "day" ON "day".id = "block"."dayId"
WHERE 
    "block"."datetime" > NOW() + INTERVAL '-7 days'
    AND "day"."aktPrice" IS NOT NULL
    AND "message"."amount" IS NOT NULL
    AND "message"."type" = '/cosmos.bank.v1beta1.MsgSend'
ORDER BY "amount" / 1000000 * "day"."aktPrice" DESC
LIMIT 10
```
![Top 10 largest AKT transfers in the last 7 days](./top-10-largest-akt-transfers-in-the-last-7-days.png)

## Get all messages related to a deployment

```
SELECT height,type
FROM "message"
INNER JOIN "deployment" ON "deployment".id = "message"."relatedDeploymentId"
WHERE "owner" = '<AKASH_ADDRESS>' AND "dseq"='<DSEQ>'
ORDER BY "height" DESC
```
![Get all messages related to a deployment](./get-all-messages-related-to-a-deployment.png)