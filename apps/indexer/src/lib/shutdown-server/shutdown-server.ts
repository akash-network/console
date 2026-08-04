import type { ServerType } from "@hono/node-server";

import type { ServerLogger } from "../server-logger/server-logger";

/**
 * Shutdown the server and app services
 */
export async function shutdownServer(server: ServerType, appLogger: ServerLogger, onShutdown?: () => void | Promise<void>): Promise<void> {
  return new Promise(resolve => {
    const shutdown = (error?: unknown) => {
      if (error) {
        appLogger.error({ event: "SERVER_CLOSE_ERROR", error });
      }

      Promise.resolve(onShutdown?.())
        .catch(error => {
          appLogger.error({ event: "ON_SHUTDOWN_ERROR", error });
        })
        .finally(() => {
          resolve();
        });
    };

    try {
      if (server.listening) {
        server.close(shutdown);
      } else {
        shutdown();
      }
    } catch (error) {
      shutdown(error);
    }
  });
}
