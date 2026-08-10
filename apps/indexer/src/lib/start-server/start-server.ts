import type { LoggerService } from "@akashnetwork/logging";
import type { ServerType } from "@hono/node-server";
import { serve } from "@hono/node-server";
import type EventEmitter from "events";
import type { Hono } from "hono";
import { once } from "lodash";

import { shutdownServer } from "../shutdown-server/shutdown-server";
import type { AppInitializer } from "./app-initializer";
import { ON_APP_START, ON_APP_STOP } from "./app-initializer";

/** Containers usually allow 30s before SIGKILL, so bail out well before that to keep logs flushable. */
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;

/** Exit code signalling that shutdown did not finish within its deadline. */
const SHUTDOWN_TIMEOUT_EXIT_CODE = 1;

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
  logger: LoggerService,
  processEvents: EventEmitter,
  options: {
    port: number;
    beforeStart?: () => Promise<void>;
    initializers?: AppInitializer[];
    onStop?: () => void | Promise<void>;
    shutdownTimeoutMs?: number;
    onShutdownTimeout?: () => void;
  }
): Promise<ServerType | undefined> {
  const initializers = options.initializers ?? [];
  const shutdownTimeoutMs = options.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;
  const forceExit = options.onShutdownTimeout ?? (() => process.exit(SHUTDOWN_TIMEOUT_EXIT_CODE));
  const stopAppOnce = once(async () => {
    logger.info({ event: "APP_STOPPING" });

    try {
      await options.onStop?.();
    } catch (error) {
      logger.error({ event: "APP_STOP_ERROR", error });
    }

    const stopResults = await Promise.allSettled(
      initializers.map(async initializer => {
        await initializer[ON_APP_STOP]?.();
      })
    );
    stopResults.forEach(result => {
      if (result.status === "rejected") {
        logger.error({ event: "APP_INITIALIZER_STOP_ERROR", error: result.reason });
      }
    });
  });

  let server: ServerType | undefined;
  let isShuttingDown = false;
  let startupPromise = Promise.resolve();
  const shutdown = once(async (reason: string) => {
    isShuttingDown = true;
    logger.info({ event: "APP_SERVER_SHUTDOWN_REQUESTED", reason });
    const forceExitTimer = setTimeout(() => {
      logger.error({ event: "APP_SHUTDOWN_TIMEOUT", reason, shutdownTimeoutMs });
      forceExit();
    }, shutdownTimeoutMs);
    forceExitTimer.unref();

    try {
      await startupPromise.catch(() => undefined);

      if (server) {
        await shutdownServer(server, logger, stopAppOnce);
      } else {
        await stopAppOnce();
      }
    } finally {
      clearTimeout(forceExitTimer);
    }
  });
  const startApp = async () => {
    await options.beforeStart?.();

    if (isShuttingDown) return;

    const results = await Promise.allSettled(
      initializers.map(async initializer => {
        await initializer[ON_APP_START]?.();
      })
    );
    const rejectedResult = results.find(result => result.status === "rejected");
    if (rejectedResult) throw rejectedResult.reason;
  };

  processEvents.on("SIGTERM", () => shutdown("SIGTERM"));
  processEvents.on("SIGINT", () => shutdown("SIGINT"));

  try {
    startupPromise = startApp();
    await startupPromise;

    if (isShuttingDown) {
      logger.info({ event: "SERVER_START_ABORTED" });
      await shutdown("SERVER_START_ABORTED");
      return undefined;
    }

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
    return server;
  } catch (error) {
    logger.error({ event: "SERVER_START_ERROR", error });
    await shutdown("SERVER_START_ERROR");
    throw error;
  }
}
