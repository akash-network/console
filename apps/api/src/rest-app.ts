import "./app";

import { HttpLoggerInterceptor } from "@akashnetwork/logging/hono";
import { createOtelLogger } from "@akashnetwork/logging/otel";
import { otel } from "@hono/otel";
import { swaggerUI } from "@hono/swagger-ui";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import assert from "http-assert";
import { container } from "tsyringe";

import packageJson from "../package.json";
import { verifyEmailRouter } from "./auth/routes/verify-email/verify-email.router";
import { AuthInterceptor } from "./auth/services/auth.interceptor";
import { bidsRouter } from "./bid/routes/bids/bids.router";
import { certificateRouter } from "./certificate/routes/certificate.router";
import { HonoErrorHandlerService } from "./core/services/hono-error-handler/hono-error-handler.service";
import type { OpenApiHonoHandler } from "./core/services/open-api-hono-handler/open-api-hono-handler";
import { OpenApiDocsService } from "./core/services/openapi-docs/openapi-docs.service";
import { RequestContextInterceptor } from "./core/services/request-context-interceptor/request-context.interceptor";
import { startServer } from "./core/services/start-server/start-server";
import type { AppEnv } from "./core/types/app-context";
import { connectUsingSequelize } from "./db/dbConnection";
import { deploymentSettingRouter } from "./deployment/routes/deployment-setting/deployment-setting.router";
import { deploymentsRouter } from "./deployment/routes/deployments/deployments.router";
import { leasesRouter } from "./deployment/routes/leases/leases.router";
import { healthzRouter } from "./healthz/routes/healthz.router";
import { cacheControlMiddleware } from "./middlewares/cacheControlMiddleware";
import { clientInfoMiddleware } from "./middlewares/clientInfoMiddleware";
import { notificationsApiProxy } from "./notifications/routes/proxy/proxy.route";
import { apiRouter } from "./routers/apiRouter";
import { dashboardRouter } from "./routers/dashboardRouter";
import { deploymentRouter } from "./routers/deploymentApiRouter";
import { internalRouter } from "./routers/internalRouter";
import { legacyRouter } from "./routers/legacyRouter";
import { userRouter } from "./routers/userRouter";
import { web3IndexRouter } from "./routers/web3indexRouter";
import { bytesToHumanReadableSize } from "./utils/files";
import { addressRouter } from "./address";
import { apiKeysRouter, sendVerificationEmailRouter } from "./auth";
import {
  getBalancesRouter,
  getWalletListRouter,
  signAndBroadcastTxRouter,
  startTrialRouter,
  stripeCouponsRouter,
  stripeCustomersRouter,
  stripePaymentMethodsRouter,
  stripePricesRouter,
  stripeTransactionsRouter,
  stripeWebhook,
  usageRouter,
  walletSettingRouter
} from "./billing";
import { blockPredictionRouter, blocksRouter } from "./block";
import { CORE_CONFIG, migratePG } from "./core";
import { dashboardDataRouter, graphDataRouter, leasesDurationRouter, marketDataRouter, networkCapacityRouter } from "./dashboard";
import { gpuRouter } from "./gpu";
import { networkRouter } from "./network";
import { pricingRouter } from "./pricing";
import { proposalsRouter } from "./proposal";
import {
  auditorsRouter,
  providerAttributesSchemaRouter,
  providerDashboardRouter,
  providerDeploymentsRouter,
  providerEarningsRouter,
  providerGraphDataRouter,
  providerJwtTokenRouter,
  providerRegionsRouter,
  providersRouter,
  providerVersionsRouter
} from "./provider";
import { templatesRouter } from "./template";
import { transactionsRouter } from "./transaction";
import { getCurrentUserRouter, registerUserRouter } from "./user";
import { validatorsRouter } from "./validator";

const appHono = new Hono<AppEnv>();
appHono.use("*", otel());
appHono.use(
  "/*",
  cors({
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH", "OPTIONS"],
    origin: origin => {
      const origins = container.resolve(CORE_CONFIG).CORS_WEBSITE_URLS?.split(",") || [];
      return origins.includes(origin) ? origin : null;
    },
    credentials: true,
    exposeHeaders: ["cf-mitigated"]
  })
);
appHono.use("*", compress());

appHono.use(container.resolve(HttpLoggerInterceptor).intercept());
appHono.use(container.resolve(RequestContextInterceptor).intercept());
appHono.use(container.resolve(AuthInterceptor).intercept());
appHono.use(cacheControlMiddleware);
appHono.use(clientInfoMiddleware);

appHono.route("/", legacyRouter);
appHono.route("/", apiRouter);
appHono.route("/user", userRouter);
appHono.route("/web3-index", web3IndexRouter);
appHono.route("/dashboard", dashboardRouter);
appHono.route("/internal", internalRouter);
appHono.route("/deployments", deploymentRouter);

const openApiHonoHandlers: OpenApiHonoHandler[] = [
  startTrialRouter,
  getWalletListRouter,
  walletSettingRouter,
  signAndBroadcastTxRouter,
  stripeWebhook,
  stripePricesRouter,
  stripeCouponsRouter,
  stripeCustomersRouter,
  stripePaymentMethodsRouter,
  stripeTransactionsRouter,
  usageRouter,
  registerUserRouter,
  getCurrentUserRouter,
  sendVerificationEmailRouter,
  verifyEmailRouter,
  deploymentSettingRouter,
  deploymentsRouter,
  leasesRouter,
  apiKeysRouter,
  bidsRouter,
  certificateRouter,
  getBalancesRouter,
  providersRouter,
  auditorsRouter,
  providerAttributesSchemaRouter,
  providerRegionsRouter,
  providerDashboardRouter,
  providerEarningsRouter,
  providerVersionsRouter,
  providerGraphDataRouter,
  providerDeploymentsRouter,
  providerJwtTokenRouter,
  graphDataRouter,
  dashboardDataRouter,
  networkCapacityRouter,
  blocksRouter,
  blockPredictionRouter,
  transactionsRouter,
  marketDataRouter,
  validatorsRouter,
  pricingRouter,
  gpuRouter,
  proposalsRouter,
  templatesRouter,
  leasesDurationRouter,
  addressRouter,
  networkRouter
];
for (const handler of openApiHonoHandlers) {
  appHono.route("/", handler);
}

appHono.route("/", notificationsApiProxy);

appHono.route("/", healthzRouter);

appHono.get("/status", c => {
  const version = packageJson.version;
  const memoryInBytes = process.memoryUsage();
  const memory = {
    rss: bytesToHumanReadableSize(memoryInBytes.rss),
    heapTotal: bytesToHumanReadableSize(memoryInBytes.heapTotal),
    heapUsed: bytesToHumanReadableSize(memoryInBytes.heapUsed),
    external: bytesToHumanReadableSize(memoryInBytes.external)
  };

  return c.json({ version, memory });
});

appHono.get("/v1/doc", async c => {
  const scope = c.req.query("scope") || "full";
  assert(["full", "console"].includes(scope), 403, '"scope" query is invalid. Valid options: "full", "api"');
  return c.json(await container.resolve(OpenApiDocsService).generateDocs(openApiHonoHandlers, { scope }));
});
appHono.get("/v1/swagger", swaggerUI({ url: "/v1/doc" }));

appHono.onError(container.resolve(HonoErrorHandlerService).handle);

export { appHono as app, connectUsingSequelize as initDb };

export async function bootstrap(): Promise<void> {
  await startServer(appHono, createOtelLogger({ context: "APP" }), process, {
    port: container.resolve(CORE_CONFIG).PORT,
    beforeStart: migratePG
  });
}
