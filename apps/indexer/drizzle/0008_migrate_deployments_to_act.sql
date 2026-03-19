-- BME Upgrade (Proposal 318, height 26063777): Migrate USDC deployments/leases to ACT
-- USDC → ACT is 1:1 (burn axlUSDC, mint uACT). Only denom changes, no value conversion needed.
-- This is idempotent: WHERE denom = 'uusdc' ensures it won't re-run on already-migrated rows.

-- Deployments: flip denom from uusdc → uact for open deployments
UPDATE deployment SET denom = 'uact'
WHERE denom = 'uusdc' AND "closedHeight" IS NULL;

-- Leases: flip denom from uusdc → uact for active leases
UPDATE lease SET denom = 'uact'
WHERE denom = 'uusdc' AND "closedHeight" IS NULL;
