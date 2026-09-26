import { HttpLoggerInterceptor } from "@akashnetwork/logging/hono";
import { otel } from "@hono/otel";
import { Hono } from "hono";
import { container } from "tsyringe";

import { apiHandlers } from "@src/routes";
import { HonoErrorHandlerService } from "@src/services/hono-error-handler/hono-error-handler.service";
import { OpenApiDocsService } from "@src/services/openapi-docs/openapi-docs.service";
import type { AppEnv } from "@src/types/app-context";

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use("*", otel({ captureRequestHeaders: ["baggage"] }));
  app.use(container.resolve(HttpLoggerInterceptor).intercept());
  for (const handler of apiHandlers) {
    app.route("/", handler);
  }
  app.get("/v1/doc", c => c.json(container.resolve(OpenApiDocsService).generate(apiHandlers)));
  app.onError(container.resolve(HonoErrorHandlerService).handle);

  return app;
}
