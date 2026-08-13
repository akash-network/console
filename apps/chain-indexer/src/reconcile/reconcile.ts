import "@src/providers";

import { createOtelLogger } from "@akashnetwork/logging/otel";
import { container } from "tsyringe";

import { envSchema } from "@src/config/env.config";
import { PgClientService } from "@src/db/pg-client.service";
import { ReconcileService } from "@src/reconcile/reconcile.service";

/**
 * One-shot reconciliation entrypoint (`npm run reconcile`): exits 0 when the ledger matches the chain at the
 * sync checkpoint height, non-zero on any mismatch or misconfiguration, so it can gate a deploy.
 */
async function main(): Promise<void> {
  const logger = createOtelLogger({ context: "RECONCILE_CLI" });

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    logger.error({ event: "CONFIG_INVALID", issues: parsed.error.issues.map(issue => ({ path: issue.path.join(".") || "(root)", message: issue.message })) });
    process.exitCode = 1;
    return;
  }

  const sampleSize = parsed.data.RECONCILE_SAMPLE_SIZE;

  try {
    const ok = await container.resolve(ReconcileService).reconcile(sampleSize === undefined ? {} : { sampleSize });
    process.exitCode = ok ? 0 : 1;
  } catch (error) {
    logger.error({ event: "RECONCILE_FATAL", error });
    process.exitCode = 1;
  } finally {
    await container.resolve(PgClientService).dispose();
  }
}

void main();
