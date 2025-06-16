import type { Logger } from "@akashnetwork/logging";
import type { ServerType } from "@hono/node-server";

let isShuttingDown = false;
/**
 * Shutdown the server and app services
 */
export async function shutdownServer(server: ServerType, appLogger: Logger, onShutdown: () => void | Promise<void>): Promise<void> {
  if (isShuttingDown) return;

  isShuttingDown = true;

  return new Promise(resolve => {
    const shutdown = (error: unknown) => {
      if (error) {
        appLogger.error({ event: "SERVER_CLOSE_ERROR", error });
      }

      Promise.resolve(onShutdown())
        .catch(error => {
          appLogger.error({ event: "CONTAINER_DISPOSE_ERROR", error });
        })
        .finally(() => {
          isShuttingDown = false;
          resolve();
        });
    };

    try {
      server.close(shutdown);
    } catch (error) {
      shutdown(error);
    }
  });
}
