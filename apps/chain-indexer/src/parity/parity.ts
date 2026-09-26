import "@src/providers";

import { createOtelLogger } from "@akashnetwork/logging/otel";
import { writeFile } from "node:fs/promises";
import { container } from "tsyringe";

import type { EnvConfig } from "@src/config/env.config";
import { envSchema } from "@src/config/env.config";
import { PgClientService } from "@src/db/pg-client.service";
import type { ParityCheckName } from "@src/parity/check-names";
import { ActiveSetsCheck } from "@src/parity/checks/active-sets.check";
import { BalancesCheck } from "@src/parity/checks/balances.check";
import { DailyCountsCheck } from "@src/parity/checks/daily-counts.check";
import { HttpCheck } from "@src/parity/checks/http.check";
import type { LegacyDatabase } from "@src/parity/legacy-db";
import { createLegacyDatabase } from "@src/parity/legacy-db";
import type { ParityCheck } from "@src/parity/report";
import { buildReport, formatReport, runCheck, skippedCheck } from "@src/parity/report";
import { CHAIN_DB } from "@src/providers/db.provider";
import { FETCH } from "@src/providers/fetch.provider";
import { ReconcileService } from "@src/reconcile/reconcile.service";

/**
 * Parity entrypoint (`npm run parity`): runs the checks named in `PARITY_CHECKS` against the legacy indexer
 * and the chain, logs the report, writes it to `PARITY_OUTPUT` when set, and exits non-zero on any failing
 * check so a cutover can be gated on it.
 */
async function main(): Promise<void> {
  const logger = createOtelLogger({ context: "PARITY_CLI" });

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    logger.error({ event: "CONFIG_INVALID", issues: parsed.error.issues.map(issue => ({ path: issue.path.join(".") || "(root)", message: issue.message })) });
    process.exitCode = 1;
    return;
  }

  const config = parsed.data;
  const legacy = config.LEGACY_POSTGRES_DB_URI ? createLegacyDatabase(config.LEGACY_POSTGRES_DB_URI) : undefined;
  try {
    const results = [];
    for (const name of config.PARITY_CHECKS) {
      logger.info({ event: "PARITY_CHECK_STARTED", check: name });
      const result = await runCheck(buildCheck(name, config, legacy));
      logger.info({ event: "PARITY_CHECK_FINISHED", check: name, status: result.status, summary: result.summary, mismatches: result.mismatches.length });
      results.push(result);
    }

    const report = buildReport(results, new Date());
    logger.info({ event: "PARITY_REPORT", ok: report.ok, report: formatReport(report) });
    if (config.PARITY_OUTPUT) {
      await writeFile(config.PARITY_OUTPUT, JSON.stringify(report, null, 2));
    }
    process.exitCode = report.ok ? 0 : 1;
  } catch (error) {
    logger.error({ event: "PARITY_FATAL", error });
    process.exitCode = 1;
  } finally {
    await legacy?.end();
    await container.resolve(PgClientService).dispose();
  }
}

function buildCheck(name: ParityCheckName, config: EnvConfig, legacy: LegacyDatabase | undefined): ParityCheck {
  switch (name) {
    case "daily-counts":
      return legacy ? new DailyCountsCheck(container.resolve(CHAIN_DB), legacy) : skippedCheck(name, "LEGACY_POSTGRES_DB_URI is not set");
    case "active-sets":
      return legacy ? new ActiveSetsCheck(container.resolve(CHAIN_DB), legacy, config.PARITY_HEIGHTS) : skippedCheck(name, "LEGACY_POSTGRES_DB_URI is not set");
    case "balances":
      return new BalancesCheck(container.resolve(ReconcileService), config.RECONCILE_SAMPLE_SIZE);
    case "http":
      return config.LEGACY_API_BASE_URL && config.PARITY_V2_API_BASE_URL
        ? new HttpCheck(container.resolve(FETCH), {
            legacyBaseUrl: config.LEGACY_API_BASE_URL,
            v2BaseUrl: config.PARITY_V2_API_BASE_URL,
            heights: config.PARITY_HEIGHTS,
            addresses: config.PARITY_ADDRESSES,
            sampleLimit: config.PARITY_SAMPLE_LIMIT
          })
        : skippedCheck(name, "LEGACY_API_BASE_URL and PARITY_V2_API_BASE_URL are not both set");
  }
}

void main();
