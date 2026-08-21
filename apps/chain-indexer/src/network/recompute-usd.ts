import "@src/providers";

import { createOtelLogger } from "@akashnetwork/logging/otel";
import { container } from "tsyringe";

import { envSchema } from "@src/config/env.config";
import { PgClientService } from "@src/db/pg-client.service";
import { DayCloseUsdService } from "@src/network/day-close-usd.service";
import { CHAIN_DB } from "@src/providers/db.provider";

/**
 * One-shot USD restatement entrypoint (`npm run network:recompute-usd`): recomputes `daily_usd_spent`
 * for every rollup day whose stored price differs from `daily_prices`, touching one row per affected
 * day. Exits 0 on success (including nothing to restate), non-zero on failure.
 */
async function main(): Promise<void> {
  const logger = createOtelLogger({ context: "RECOMPUTE_USD_CLI" });

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    logger.error({ event: "CONFIG_INVALID", issues: parsed.error.issues.map(issue => ({ path: issue.path.join(".") || "(root)", message: issue.message })) });
    process.exitCode = 1;
    return;
  }

  try {
    const dates = await container.resolve(DayCloseUsdService).recompute(container.resolve(CHAIN_DB));
    logger.info({ event: "RECOMPUTE_USD_DONE", count: dates.length });
  } catch (error) {
    logger.error({ event: "RECOMPUTE_USD_FATAL", error });
    process.exitCode = 1;
  } finally {
    await container.resolve(PgClientService).dispose();
  }
}

void main();
