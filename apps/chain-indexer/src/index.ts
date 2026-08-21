import "reflect-metadata";
import "@src/providers";

import type { LoggerService } from "@akashnetwork/logging";
import { createOtelLogger } from "@akashnetwork/logging/otel";
import { container } from "tsyringe";

import { createApp } from "@src/app";
import { envSchema } from "@src/config/env.config";
import { BackfillRunnerService } from "@src/pipeline/backfill-runner.service";
import { RunnerInterruptedError } from "@src/pipeline/runner-interrupted-error";
import { SyncRunnerService } from "@src/pipeline/sync-runner.service";
import { migrateDb } from "@src/providers/db.provider";
import { AppConfigService } from "@src/services/app-config/app-config.service";
import { shutdownServer } from "@src/services/shutdown-server/shutdown-server";
import { startServer } from "@src/services/start-server/start-server";

export async function bootstrap(): Promise<void> {
  const logger = createOtelLogger({ context: "APP" });

  if (!validateConfig(logger)) {
    process.exitCode = 1;
    return;
  }

  const config = container.resolve(AppConfigService);
  const role = config.get("INDEXER_ROLE");
  const port = config.get("PORT");

  switch (role) {
    case "sync": {
      await runRunnerBehindServer(() => container.resolve(SyncRunnerService), "SYNC_FATAL", logger, port);
      return;
    }
    case "backfill": {
      await runRunnerBehindServer(() => container.resolve(BackfillRunnerService), "BACKFILL_FATAL", logger, port);
      return;
    }
    case "api": {
      await migrateDb();
      await startServer(createApp(), logger, process, { port });
      return;
    }
    default: {
      logger.error({ event: "ROLE_NOT_IMPLEMENTED", role });
      process.exitCode = 1;
    }
  }
}

/** Validates env eagerly so a misconfigured role (e.g. a backfill Job missing BACKFILL_FROM/TO_HEIGHT) fails with the actual field errors instead of a tsyringe dependency-injection wrapper around the ZodError. */
function validateConfig(logger: LoggerService): boolean {
  const result = envSchema.safeParse(process.env);

  if (result.success) {
    return true;
  }

  logger.error({
    event: "CONFIG_INVALID",
    issues: result.error.issues.map(issue => ({ path: issue.path.join(".") || "(root)", message: issue.message }))
  });
  return false;
}

/**
 * Shared runner-role lifecycle: migrate, serve healthz, run to completion, then shut the server
 * down so the process can exit. A fatal error exits non-zero; a run stopped before finishing
 * (`RunnerInterruptedError`, e.g. SIGTERM mid-backfill) also exits non-zero so a K8s Job is retried
 * and resumes from its checkpoint rather than being marked Complete with the range unfinished.
 */
async function runRunnerBehindServer(resolveRunner: () => { start(): Promise<void> }, fatalEvent: string, logger: LoggerService, port: number): Promise<void> {
  await migrateDb();
  const server = await startServer(createApp(), logger, process, { port });

  try {
    await resolveRunner().start();
  } catch (error) {
    if (error instanceof RunnerInterruptedError) {
      logger.warn({ event: "RUNNER_INTERRUPTED", error });
    } else {
      logger.error({ event: fatalEvent, error });
    }
    process.exitCode = 1;
  }

  await shutdownServer(server, logger);
}
