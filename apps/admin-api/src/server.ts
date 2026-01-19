import { LoggerService } from "@akashnetwork/logging";
import { serve } from "@hono/node-server";
import { container } from "tsyringe";

import { ADMIN_CONFIG } from "./core/providers/config.provider";
import { app, initDb } from "./rest-app";

const logger = LoggerService.forContext("SERVER");

async function bootstrap() {
  try {
    // Initialize database connection
    await initDb();

    const config = container.resolve(ADMIN_CONFIG);
    const port = config.PORT;

    logger.info({ event: "SERVER_STARTING", port });

    const server = serve({
      fetch: app.fetch,
      port
    });

    logger.info({ event: "SERVER_STARTED", url: `http://localhost:${port}` });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ event: "SHUTDOWN_REQUESTED", signal });
      server.close(() => {
        logger.info({ event: "SERVER_CLOSED" });
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    logger.error({ event: "SERVER_START_ERROR", error });
    process.exit(1);
  }
}

bootstrap();
