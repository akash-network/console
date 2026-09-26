import "@src/providers";

import { createOtelLogger } from "@akashnetwork/logging/otel";
import postgres from "postgres";
import { container } from "tsyringe";

import { envSchema } from "@src/config/env.config";
import { PgClientService } from "@src/db/pg-client.service";
import { LegacyPriceSeedService } from "@src/jobs/legacy-price-seed/legacy-price-seed.service";

/**
 * One-time entrypoint (`npm run prices:seed-legacy`): copies the legacy indexer's `day.aktPrice` history
 * into `daily_prices`, so daily USD reaches back to genesis instead of the year CoinGecko serves.
 * Exits non-zero on failure.
 */
async function main(): Promise<void> {
  const logger = createOtelLogger({ context: "LEGACY_PRICE_SEED_CLI" });

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    logger.error({ event: "CONFIG_INVALID", issues: parsed.error.issues.map(issue => ({ path: issue.path.join(".") || "(root)", message: issue.message })) });
    process.exitCode = 1;
    return;
  }
  if (!parsed.data.LEGACY_POSTGRES_DB_URI) {
    logger.error({ event: "CONFIG_INVALID", issues: [{ path: "LEGACY_POSTGRES_DB_URI", message: "Required to read the legacy indexer's day table" }] });
    process.exitCode = 1;
    return;
  }

  const legacy = postgres(parsed.data.LEGACY_POSTGRES_DB_URI, { max: 1 });
  try {
    const rows = await legacy<{ date: string; price: number }[]>`
      SELECT to_char("date" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date, "aktPrice"::float8 AS price
      FROM "day"
      WHERE "aktPrice" IS NOT NULL
      ORDER BY "date"
    `;
    const outcome = await container.resolve(LegacyPriceSeedService).seed(rows.map(row => ({ date: row.date, price: row.price })));
    logger.info({ event: "LEGACY_PRICE_SEED_DONE", ...outcome });
  } catch (error) {
    logger.error({ event: "LEGACY_PRICE_SEED_FATAL", error });
    process.exitCode = 1;
  } finally {
    await legacy.end();
    await container.resolve(PgClientService).dispose();
  }
}

void main();
