import { HttpLoggerInterceptor } from "@akashnetwork/logging/hono";
import { createOtelLogger } from "@akashnetwork/logging/otel";
import { otel } from "@hono/otel";
import { Hono } from "hono";
import { container } from "tsyringe";

import { APP_CONFIG } from "@src/providers/app-config.provider";
import { healthzRouter } from "@src/routes";
import { DiscoverySchedulerService } from "@src/services/discovery-scheduler/discovery-scheduler.service";
import { HonoErrorHandlerService } from "@src/services/hono-error-handler/hono-error-handler.service";
import { startServer } from "@src/services/start-server/start-server";
import type { AppEnv } from "@src/types/app-context";

export async function bootstrap(): Promise<void> {
  const app = new Hono<AppEnv>();
  app.use("*", otel({ captureRequestHeaders: ["baggage"] }));
  app.use(container.resolve(HttpLoggerInterceptor).intercept());
  app.route("/", healthzRouter);
  app.onError(container.resolve(HonoErrorHandlerService).handle);

  const appLogger = createOtelLogger({ context: "PROVIDERS_SYNC" });
  const server = await startServer(app, appLogger, process, {
    port: container.resolve(APP_CONFIG).PORT
  });

  if (server) {
    try {
      await container.resolve(DiscoverySchedulerService).warmUp();
      container.resolve(DiscoverySchedulerService).start();
    } catch (error) {
      server.close();
      throw error;
    }
  }
}
