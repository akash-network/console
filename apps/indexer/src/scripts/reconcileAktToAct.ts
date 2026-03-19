/**
 * BME Upgrade Reconciliation Script: AKT → ACT
 *
 * After the BME upgrade (Proposal 318, height 26063777), the chain gradually migrates
 * AKT-denominated deployments/leases to ACT via the x/deployment EndBlocker.
 *
 * This script connects to both the chain LCD and the indexer DB, then for each
 * active deployment still in uakt, fetches the on-chain ACT values and updates
 * the DB row immediately — no generated SQL, no TOCTOU gap.
 *
 * Usage:
 *   npx tsx apps/indexer/src/scripts/reconcileAktToAct.ts --db <connection-string> [--lcd-url <url>] [--dry-run]
 *
 * Options:
 *   --db        PostgreSQL connection string (required)
 *   --lcd-url   LCD REST endpoint (default: https://rpc.akt.dev/rest)
 *   --dry-run   Only print what would be updated, don't write to DB
 */

import axios from "axios";
import pg from "pg";

const DEFAULT_LCD_URL = "https://rpc.akt.dev/rest";
const PAGINATION_LIMIT = 100;

interface ChainLease {
  lease: {
    lease_id: {
      owner: string;
      dseq: string;
      gseq: string;
      oseq: string;
      provider: string;
    };
    price: {
      denom: string;
      amount: string;
    };
  };
}

interface DbDeployment {
  owner: string;
  dseq: string;
}

function parseArgs(): { lcdUrl: string; dbConnectionString: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  let lcdUrl = DEFAULT_LCD_URL;
  let dbConnectionString = "";
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--lcd-url" && args[i + 1]) {
      lcdUrl = args[++i];
    } else if (args[i] === "--db" && args[i + 1]) {
      dbConnectionString = args[++i];
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  if (!dbConnectionString) {
    console.error("ERROR: --db <connection-string> is required");
    process.exit(1);
  }

  return { lcdUrl, dbConnectionString, dryRun };
}

async function fetchChainDeployment(lcdUrl: string, owner: string, dseq: string) {
  const url = `${lcdUrl}/akash/deployment/v1beta4/deployments/info?id.owner=${owner}&id.dseq=${dseq}`;
  const response = await axios.get(url, { timeout: 30_000 });
  return response.data;
}

async function fetchActiveLeases(lcdUrl: string, owner: string, dseq: string): Promise<ChainLease[]> {
  const leases: ChainLease[] = [];
  let nextKey: string | null = null;

  do {
    const params = new URLSearchParams({
      "filters.owner": owner,
      "filters.dseq": dseq,
      "filters.state": "active",
      "pagination.limit": String(PAGINATION_LIMIT)
    });

    if (nextKey) {
      params.set("pagination.key", nextKey);
    }

    const url = `${lcdUrl}/akash/market/v1beta4/leases/list?${params}`;
    const response = await axios.get(url, { timeout: 30_000 });
    const data = response.data;

    leases.push(...data.leases);
    nextKey = data.pagination?.next_key || null;
  } while (nextKey);

  return leases;
}

async function main() {
  const { lcdUrl, dbConnectionString, dryRun } = parseArgs();

  console.log(`LCD URL:  ${lcdUrl}`);
  console.log(`Dry run:  ${dryRun}`);
  console.log("");

  const client = new pg.Client({ connectionString: dbConnectionString });
  await client.connect();
  console.log("Connected to database.");

  // Find all active deployments still in uakt
  const { rows: aktDeployments } = await client.query<DbDeployment>(`SELECT owner, dseq FROM deployment WHERE denom = 'uakt' AND "closedHeight" IS NULL`);

  console.log(`Found ${aktDeployments.length} active uakt deployments in DB.\n`);

  let updatedDeployments = 0;
  let updatedLeases = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < aktDeployments.length; i++) {
    const { owner, dseq } = aktDeployments[i];
    const label = `${owner}/${dseq}`;

    if ((i + 1) % 20 === 0) {
      console.log(`Progress: ${i + 1}/${aktDeployments.length}`);
    }

    try {
      // Fetch current on-chain state for this deployment
      const chainData = await fetchChainDeployment(lcdUrl, owner, dseq);
      const funds = chainData?.escrow_account?.state?.funds;
      const transferred = chainData?.escrow_account?.state?.transferred;

      if (!funds || funds.length === 0) {
        console.warn(`  WARN: No escrow funds for ${label}, skipping`);
        errors++;
        continue;
      }

      const actFund = funds.find((f: { denom: string }) => f.denom === "uact");
      if (!actFund) {
        const aktFund = funds.find((f: { denom: string }) => f.denom === "uakt");
        if (aktFund) {
          console.warn(`  WARN: ${label} still in uakt on chain — gradual migration not complete yet`);
          skipped++;
        } else {
          console.warn(`  WARN: ${label} has unexpected denom: ${funds[0]?.denom}`);
          errors++;
        }
        continue;
      }

      const actTransferred = transferred?.find((f: { denom: string }) => f.denom === "uact");
      const balance = parseFloat(actFund.amount);
      const withdrawnAmount = actTransferred ? parseFloat(actTransferred.amount) : 0;
      const deposit = balance + withdrawnAmount;

      // Fetch leases for this deployment
      const chainLeases = await fetchActiveLeases(lcdUrl, owner, dseq);

      if (dryRun) {
        console.log(`  [DRY RUN] Would update deployment ${label}: balance=${balance}, deposit=${deposit}, withdrawn=${withdrawnAmount}`);
        for (const cl of chainLeases) {
          const lid = cl.lease.lease_id;
          console.log(`    [DRY RUN] Would update lease gseq=${lid.gseq} oseq=${lid.oseq} provider=${lid.provider}: price=${cl.lease.price.amount}`);
        }
      } else {
        // Update deployment in a transaction
        await client.query("BEGIN");

        await client.query(
          `UPDATE deployment SET denom = 'uact', balance = $1, deposit = $2, "withdrawnAmount" = $3 WHERE owner = $4 AND dseq = $5 AND denom = 'uakt'`,
          [balance, deposit, withdrawnAmount, owner, dseq]
        );

        for (const cl of chainLeases) {
          const lid = cl.lease.lease_id;
          if (cl.lease.price.denom !== "uact") {
            console.warn(`    WARN: Lease ${lid.gseq}/${lid.oseq} has denom ${cl.lease.price.denom}, skipping`);
            continue;
          }

          const result = await client.query(
            `UPDATE lease SET denom = 'uact', price = $1 WHERE owner = $2 AND dseq = $3 AND gseq = $4 AND oseq = $5 AND "providerAddress" = $6 AND denom = 'uakt' AND "closedHeight" IS NULL`,
            [parseFloat(cl.lease.price.amount), owner, dseq, parseInt(lid.gseq), parseInt(lid.oseq), lid.provider]
          );
          updatedLeases += result.rowCount ?? 0;
        }

        await client.query("COMMIT");
      }

      updatedDeployments++;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(`  ERROR ${label}:`, (err as Error).message);
      errors++;
    }
  }

  await client.end();

  console.log("");
  console.log("=== Summary ===");
  console.log(`Deployments updated: ${updatedDeployments}`);
  console.log(`Leases updated:      ${updatedLeases}`);
  console.log(`Skipped (still AKT): ${skipped}`);
  console.log(`Errors:              ${errors}`);

  if (skipped > 0) {
    console.warn("\nSome deployments are still in uakt. Run again after the gradual migration completes.");
  }

  if (errors > 0) {
    console.warn("\nThere were errors. Review the output above.");
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
