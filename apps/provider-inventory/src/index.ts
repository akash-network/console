import "reflect-metadata";
import "@src/providers";
import "./model-schemas";

import { HttpLoggerInterceptor } from "@akashnetwork/logging/hono";
import { createOtelLogger } from "@akashnetwork/logging/otel";
import { otel } from "@hono/otel";
import { Hono } from "hono";
import { container } from "tsyringe";

import { APP_CONFIG } from "@src/providers/app-config.provider";
import { healthzRouter } from "@src/routes";
import { HonoErrorHandlerService } from "@src/services/hono-error-handler/hono-error-handler.service";
import { startServer } from "@src/services/start-server/start-server";
import type { AppEnv } from "@src/types/app-context";

export const app = new Hono<AppEnv>();
app.use("*", otel({ captureRequestHeaders: ["baggage"] }));
app.use(container.resolve(HttpLoggerInterceptor).intercept());
app.route("/", healthzRouter);
app.onError(container.resolve(HonoErrorHandlerService).handle);

export async function bootstrap(): Promise<void> {
  await startServer(app, createOtelLogger({ context: "APP" }), process, {
    port: container.resolve(APP_CONFIG).PORT
  });
}
