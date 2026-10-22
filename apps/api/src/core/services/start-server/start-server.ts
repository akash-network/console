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
 * Runs registered in container `APP_INITIALIZER`s
 * Starts hono server
 * Registers shutdown process signals
 */
export async function startServer(
  app: Hono<any>,
  logger: LoggerService,
  processEvents: EventEmitter & Pick<NodeJS.Process, "exitCode">,
  options: {
    port: number;
    beforeStart?: () => Promise<void>;
    /** The container disposes everything at once, database clients included, so work that still queries must finish here first. */
    beforeDispose?: () => Promise<void>;
    container?: DependencyContainer;
  }
): Promise<ServerType | undefined> {
  const container = options.container ?? rootContainer;
  const disposeContainerOnce = once(async () => {
    await options.beforeDispose?.().catch(error => {
      logger.error({ event: "BEFORE_DISPOSE_ERROR", error });
    });
    logger.info({ event: "DISPOSING_CONTAINER" });
    return Promise.resolve(container.dispose()).catch(error => {
      logger.error({ event: "CONTAINER_DISPOSE_ERROR", error });
    });
  });

  let server: ServerType | undefined;
  const shutdown = once(async (reason: string) => {
    logger.info({ event: "APP_SERVER_SHUTDOWN_REQUESTED", reason });
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
      fetch: async (request, env) => {
        try {
          return await app.fetch(request, env);
        } catch (error) {
          logger.error({ event: "OUTSIDE_OF_APP_ERROR", error });
          throw error;
        }
      },
      port: options.port
    });

    server.on("close", disposeContainerOnce);
    processEvents.on("SIGTERM", () => shutdown("SIGTERM"));
    processEvents.on("SIGINT", () => shutdown("SIGINT"));
    processEvents.on("exit", exitCode => shutdown(`EXIT:${exitCode}`));
    return server;
  } catch (error) {
    logger.error({ event: "SERVER_START_ERROR", error });
    processEvents.exitCode = 1;
    await shutdown("SERVER_START_ERROR");
  }
}
