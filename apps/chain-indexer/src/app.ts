import { HttpLoggerInterceptor } from "@akashnetwork/logging/hono";
import { otel } from "@hono/otel";
import { Hono } from "hono";
import { container } from "tsyringe";

import type { EnvConfig } from "@src/config/env.config";
import { apiHandlers } from "@src/routes";
import { handlersForRole } from "@src/routes/handlers-for-role";
import { HonoErrorHandlerService } from "@src/services/hono-error-handler/hono-error-handler.service";
import { OpenApiDocsService } from "@src/services/openapi-docs/openapi-docs.service";
import type { AppEnv } from "@src/types/app-context";

export function createApp(role: EnvConfig["INDEXER_ROLE"]): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use("*", otel({ captureRequestHeaders: ["baggage"] }));
  app.use(container.resolve(HttpLoggerInterceptor).intercept());
  for (const handler of handlersForRole(role)) {
    app.route("/", handler);
  }
  if (role === "api") {
    app.get("/v1/doc", c => c.json(container.resolve(OpenApiDocsService).generate(apiHandlers)));
  }
  app.onError(container.resolve(HonoErrorHandlerService).handle);

  return app;
}
