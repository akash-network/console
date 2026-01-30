import type { Logger } from "@akashnetwork/logging";
import type { ServerType } from "@hono/node-server";

export async function shutdownServer(server: ServerType, appLogger: Logger, onShutdown?: () => void | Promise<void>): Promise<void> {
  return new Promise(resolve => {
    const shutdown = (error?: unknown) => {
      if (error) {
        appLogger.error({ event: "SERVER_CLOSE_ERROR", error });
      }

      Promise.resolve()
        .then(() => onShutdown?.())
        .catch(onShutdownError => {
          appLogger.error({ event: "ON_SHUTDOWN_ERROR", error: onShutdownError });
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
