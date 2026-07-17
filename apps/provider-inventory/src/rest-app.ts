import { HttpLoggerInterceptor } from "@akashnetwork/logging/hono";
import { createOtelLogger } from "@akashnetwork/logging/otel";
import { otel } from "@hono/otel";
import { Hono } from "hono";
import { container } from "tsyringe";

import { generateOpenApiDocument } from "@src/lib/openapi-docs/openapi-docs";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import { bidScreeningRouter, healthzRouter } from "@src/routes";
import { HonoErrorHandlerService } from "@src/services/hono-error-handler/hono-error-handler.service";
import { startServer } from "@src/services/start-server/start-server";
import type { AppEnv } from "@src/types/app-context";

export async function bootstrap(): Promise<void> {
  const app = new Hono<AppEnv>();
  app.use("*", otel({ captureRequestHeaders: ["baggage"] }));
  app.use(container.resolve(HttpLoggerInterceptor).intercept());
  app.route("/", healthzRouter);
  app.route("/", bidScreeningRouter);
  app.get("/api-json", c => c.json(generateOpenApiDocument([bidScreeningRouter])));
  app.onError(container.resolve(HonoErrorHandlerService).handle);

  await startServer(app, createOtelLogger({ context: "REST" }), process, {
    port: container.resolve(APP_CONFIG).PORT
  });
}
