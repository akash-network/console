import type { ServerType } from "@hono/node-server";
import { serve } from "@hono/node-server";
import type EventEmitter from "events";
import type { Hono } from "hono";
import { once } from "lodash";

import type { ServerLogger } from "../server-logger/server-logger";
import { shutdownServer } from "../shutdown-server/shutdown-server";
import type { AppInitializer } from "./app-initializer";
import { ON_APP_START, ON_APP_STOP } from "./app-initializer";

/**
 * Runs `onAppStart` hooks of the given initializers
 * Starts hono server
 * Registers shutdown process signals
 *
 * Apps using a DI container pass their resolved initializers as `initializers`
 * and container disposal as `onStop` so this stays container agnostic.
 */
export async function startServer(
  app: Hono<any>,
  logger: ServerLogger,
  processEvents: EventEmitter,
  options: {
    port: number;
    beforeStart?: () => Promise<void>;
    initializers?: AppInitializer[];
    onStop?: () => void | Promise<void>;
  }
): Promise<ServerType | undefined> {
  const initializers = options.initializers ?? [];
  const stopAppOnce = once(async () => {
    logger.info({ event: "APP_STOPPING" });
    await runLoggingError(() => options.onStop?.(), logger, "APP_STOP_ERROR");
    await Promise.all(initializers.map(initializer => runLoggingError(() => initializer[ON_APP_STOP]?.(), logger, "APP_INITIALIZER_STOP_ERROR")));
  });

  let server: ServerType | undefined;
  const shutdown = once(async (reason: string) => {
    logger.info({ event: "APP_SERVER_SHUTDOWN_REQUESTED", reason });
    if (server) {
      await shutdownServer(server, logger, stopAppOnce);
    } else {
      await stopAppOnce();
    }
  });
  try {
    await options.beforeStart?.();
    await Promise.all(initializers.map(initializer => initializer[ON_APP_START]()));

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

    server.on("close", stopAppOnce);
    processEvents.on("SIGTERM", () => shutdown("SIGTERM"));
    processEvents.on("SIGINT", () => shutdown("SIGINT"));
    processEvents.on("exit", exitCode => shutdown(`EXIT:${exitCode}`));
    return server;
  } catch (error) {
    logger.error({ event: "SERVER_START_ERROR", error });
    await shutdown("SERVER_START_ERROR");
    throw error;
  }
}

async function runLoggingError(action: () => void | Promise<void>, logger: ServerLogger, event: string) {
  try {
    await action();
  } catch (error) {
    logger.error({ event, error });
  }
}
