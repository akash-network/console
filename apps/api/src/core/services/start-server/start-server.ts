import type { LoggerService } from "@akashnetwork/logging";
import type { ServerType } from "@hono/node-server";
import { serve } from "@hono/node-server";
import type EventEmitter from "events";
import type { Hono } from "hono";
import { once } from "lodash";
import type { DependencyContainer } from "tsyringe";
import { container as rootContainer } from "tsyringe";

import { APP_INITIALIZER, ON_APP_START } from "@src/core/providers/app-initializer";
import { shutdownServer } from "../shutdown-server/shutdown-server";

/**
 * Initialize database
 * Runs registered in container `APP_INITIALIZER`s
 * Starts hono server
 * Registers shutdown process signals
 */
export async function startServer(
  app: Hono<any>,
  logger: LoggerService,
  processEvents: EventEmitter,
  options: {
    port: number;
    beforeStart?: () => Promise<void>;
    container?: DependencyContainer;
  }
): Promise<ServerType | undefined> {
  const container = options.container ?? rootContainer;
  let server: ServerType | undefined;
  const disposeContainerOnce = once(() => {
    logger.info({ event: "DISPOSING_CONTAINER" });
    return Promise.resolve(container.dispose()).catch(error => {
      logger.error({ event: "CONTAINER_DISPOSE_ERROR", error });
    });
  });

  const shutdown = once(async () => {
    if (server) {
      await shutdownServer(server, logger, disposeContainerOnce);
    } else {
      await disposeContainerOnce();
    }
  });
  try {
    await options.beforeStart?.();
    await Promise.all(container.resolveAll(APP_INITIALIZER).map(initializer => initializer[ON_APP_START]()));

    logger.info({ event: "SERVER_STARTING", url: `http://localhost:${options.port}`, NODE_OPTIONS: process.env.NODE_OPTIONS });
    server = serve({
      fetch: app.fetch,
      port: options.port
    });

    server.on("close", disposeContainerOnce);
    processEvents.on("SIGTERM", shutdown);
    processEvents.on("SIGINT", shutdown);
    processEvents.on("exit", shutdown);
    return server;
  } catch (error) {
    logger.error({ event: "SERVER_START_ERROR", error });
    await shutdown();
  }
}
