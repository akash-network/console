import "reflect-metadata";
import "@src/providers";

import { createOtelLogger } from "@akashnetwork/logging/otel";
import { container } from "tsyringe";

import { createApp } from "@src/app";
import { SyncRunnerService } from "@src/pipeline/sync-runner.service";
import { migrateDb } from "@src/providers/db.provider";
import { AppConfigService } from "@src/services/app-config/app-config.service";
import { shutdownServer } from "@src/services/shutdown-server/shutdown-server";
import { startServer } from "@src/services/start-server/start-server";

export async function bootstrap(): Promise<void> {
  const config = container.resolve(AppConfigService);
  const role = config.get("INDEXER_ROLE");
  const logger = createOtelLogger({ context: "APP" });

  switch (role) {
    case "sync": {
      await migrateDb();
      const server = await startServer(createApp(), logger, process, { port: config.get("PORT") });

      try {
        await container.resolve(SyncRunnerService).start();
      } catch (error) {
        logger.error({ event: "SYNC_FATAL", error });
        process.exitCode = 1;
      }

      await shutdownServer(server, logger);
      return;
    }
    case "api": {
      await migrateDb();
      await startServer(createApp(), logger, process, { port: config.get("PORT") });
      return;
    }
    default: {
      logger.error({ event: "ROLE_NOT_IMPLEMENTED", role });
      process.exitCode = 1;
    }
  }
}
