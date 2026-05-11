import "reflect-metadata";
import "@src/providers";
import "./model-schemas";

import { HttpLoggerInterceptor } from "@akashnetwork/logging/hono";
import { createOtelLogger } from "@akashnetwork/logging/otel";
import { otel } from "@hono/otel";
import { Hono } from "hono";
import { container } from "tsyringe";

import { APP_CONFIG } from "@src/providers/app-config.provider";
import { ProviderInventoryRepository } from "@src/repositories/provider-inventory/provider-inventory.repository";
import { healthzRouter } from "@src/routes";
import { DiscoverySchedulerService } from "@src/services/discovery-scheduler/discovery-scheduler.service";
import { HonoErrorHandlerService } from "@src/services/hono-error-handler/hono-error-handler.service";
import { startServer } from "@src/services/start-server/start-server";
import { runStreamerBootstrap } from "@src/services/streamer-bootstrap/streamer-bootstrap";
import type { AppEnv } from "@src/types/app-context";

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use("*", otel({ captureRequestHeaders: ["baggage"] }));
  app.use(container.resolve(HttpLoggerInterceptor).intercept());
  app.route("/", healthzRouter);
  app.onError(container.resolve(HonoErrorHandlerService).handle);

  return app;
}

export async function bootstrap(): Promise<void> {
  const app = createApp();

  await startServer(app, createOtelLogger({ context: "APP" }), process, {
    port: container.resolve(APP_CONFIG).PORT,
    beforeStart: () => runStreamerBootstrap(container.resolve(ProviderInventoryRepository), container.resolve(DiscoverySchedulerService))
  });
}
