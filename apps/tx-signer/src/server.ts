import "reflect-metadata";
import "@src/providers";

import { HttpLoggerInterceptor } from "@akashnetwork/logging/hono";
import { createOtelLogger } from "@akashnetwork/logging/otel";
import { otel } from "@hono/otel";
import { Hono } from "hono";
import { container } from "tsyringe";

import { healthzRouter, txRouter } from "@src/routes";
import { AppConfigService } from "@src/services/app-config/app-config.service";
import { HonoErrorHandlerService } from "@src/services/hono-error-handler/hono-error-handler.service";
import { startServer } from "@src/services/start-server/start-server";
import type { AppEnv } from "@src/types/app-context";

export const app = new Hono<AppEnv>();
app.use("*", otel());
app.use(container.resolve(HttpLoggerInterceptor).intercept());
app.route("/", healthzRouter);
app.route("/", txRouter);
app.onError(container.resolve(HonoErrorHandlerService).handle);

export async function bootstrap(): Promise<void> {
  await startServer(app, createOtelLogger({ context: "APP" }), process, {
    port: container.resolve(AppConfigService).get("PORT")
  });
}

if (require.main === module) {
  bootstrap();
}
