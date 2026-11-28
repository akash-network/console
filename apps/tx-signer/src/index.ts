import "reflect-metadata";
import "@src/providers";

import { HttpLoggerInterceptor } from "@akashnetwork/logging/hono";
import { createOtelLogger } from "@akashnetwork/logging/otel";
import { otel } from "@hono/otel";
import { Hono } from "hono";
import { container } from "tsyringe";

import { healthzRouter, txRouter, walletRouter } from "@src/routes";
import { ApiKeyAuthInterceptor } from "@src/services/api-key-auth/api-key-auth.interceptor";
import { AppConfigService } from "@src/services/app-config/app-config.service";
import { DerivationSeedService } from "@src/services/derivation-seed/derivation-seed.service";
import { HonoErrorHandlerService } from "@src/services/hono-error-handler/hono-error-handler.service";
import { startServer } from "@src/services/start-server/start-server";
import type { AppEnv } from "@src/types/app-context";

export const app = new Hono<AppEnv>();
app.use("*", otel());
app.use(container.resolve(HttpLoggerInterceptor).intercept());
app.use("/v1/tx/*", container.resolve(ApiKeyAuthInterceptor).intercept());
app.use("/v1/wallets/*", container.resolve(ApiKeyAuthInterceptor).intercept());
app.route("/", healthzRouter);
app.route("/", txRouter);
app.route("/", walletRouter);
app.onError(container.resolve(HonoErrorHandlerService).handle);

/** A signer that cannot decrypt a derivation seed ends here with a failed start, before it listens. */
export async function bootstrap(): Promise<void> {
  await container.resolve(DerivationSeedService).load();
  await startServer(app, createOtelLogger({ context: "APP" }), process, {
    port: container.resolve(AppConfigService).get("PORT")
  });
}
