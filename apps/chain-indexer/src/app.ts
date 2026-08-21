import { HttpLoggerInterceptor } from "@akashnetwork/logging/hono";
import { otel } from "@hono/otel";
import { Hono } from "hono";
import { container } from "tsyringe";

import { healthzRouter, statusRouter } from "@src/routes";
import { HonoErrorHandlerService } from "@src/services/hono-error-handler/hono-error-handler.service";
import type { AppEnv } from "@src/types/app-context";

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use("*", otel({ captureRequestHeaders: ["baggage"] }));
  app.use(container.resolve(HttpLoggerInterceptor).intercept());
  app.route("/", healthzRouter);
  app.route("/", statusRouter);
  app.onError(container.resolve(HonoErrorHandlerService).handle);

  return app;
}
