import type { Logger } from "@akashnetwork/logging";
import type { ServerType } from "@hono/node-server";

/** Grace period for in-flight requests before remaining keep-alive sockets are destroyed so close() can complete. */
const FORCE_CLOSE_GRACE_MS = 10_000;

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
        closeConnections(server);
      } else {
        shutdown();
      }
    } catch (error) {
      shutdown(error);
    }
  });
}

/** close() only stops new connections: idle keep-alive sockets are closed immediately and stragglers destroyed after a grace period so close() can ever finish. */
function closeConnections(server: ServerType): void {
  if (!("closeIdleConnections" in server)) {
    return;
  }

  server.closeIdleConnections();
  setTimeout(() => server.closeAllConnections(), FORCE_CLOSE_GRACE_MS).unref();
}
