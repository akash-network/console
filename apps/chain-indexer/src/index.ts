import "reflect-metadata";
import "@src/providers";

import { createOtelLogger } from "@akashnetwork/logging/otel";
import { container } from "tsyringe";

import { createApp } from "@src/app";
import { BackfillRunnerService } from "@src/pipeline/backfill-runner.service";
import { SyncRunnerService } from "@src/pipeline/sync-runner.service";
import { migrateDb } from "@src/providers/db.provider";
import { AppConfigService } from "@src/services/app-config/app-config.service";
import { shutdownServer } from "@src/services/shutdown-server/shutdown-server";
import { startServer } from "@src/services/start-server/start-server";

type AppLogger = ReturnType<typeof createOtelLogger>;

export async function bootstrap(): Promise<void> {
  const config = container.resolve(AppConfigService);
  const role = config.get("INDEXER_ROLE");
  const port = config.get("PORT");
  const logger = createOtelLogger({ context: "APP" });

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

/** Shared runner-role lifecycle: migrate, serve healthz, run to completion or fatal error (exit code 1), then shut the server down so the process can exit. */
async function runRunnerBehindServer(resolveRunner: () => { start(): Promise<void> }, fatalEvent: string, logger: AppLogger, port: number): Promise<void> {
  await migrateDb();
  const server = await startServer(createApp(), logger, process, { port });

  try {
    await resolveRunner().start();
  } catch (error) {
    logger.error({ event: fatalEvent, error });
    process.exitCode = 1;
  }

  await shutdownServer(server, logger);
}
