import "./app";

import { LoggerService } from "@akashnetwork/logging";
import { HttpLoggerIntercepter } from "@akashnetwork/logging/hono";
import { otel } from "@hono/otel";
import { swaggerUI } from "@hono/swagger-ui";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { container } from "tsyringe";

import packageJson from "../package.json";
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
import { clientInfoMiddleware } from "./middlewares/clientInfoMiddleware";
import { notificationsApiProxy } from "./notifications/routes/proxy/proxy.route";
import { apiRouter } from "./routers/apiRouter";
import { dashboardRouter } from "./routers/dashboardRouter";
import { deploymentRouter } from "./routers/deploymentApiRouter";
import { internalRouter } from "./routers/internalRouter";
import { legacyRouter } from "./routers/legacyRouter";
import { userRouter } from "./routers/userRouter";
import { web3IndexRouter } from "./routers/web3indexRouter";
import { env } from "./utils/env";
import { bytesToHumanReadableSize } from "./utils/files";
import { addressRouter } from "./address";
import { apiKeysRouter, sendVerificationEmailRouter } from "./auth";
import {
  checkoutRouter,
  getBalancesRouter,
  getWalletListRouter,
  signAndBroadcastTxRouter,
  startTrialRouter,
  stripeCouponsRouter,
  stripePaymentMethodsRouter,
  stripePricesRouter,
  stripeTransactionsRouter,
  stripeWebhook,
  usageRouter
} from "./billing";
import { blockPredictionRouter, blocksRouter } from "./block";
import type { AppInitializer } from "./core";
import { APP_INITIALIZER, migratePG, ON_APP_START } from "./core";
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
  providerRegionsRouter,
  providersRouter,
  providerVersionsRouter
} from "./provider";
import { Scheduler } from "./scheduler";
import { templatesRouter } from "./template";
import { transactionsRouter } from "./transaction";
import { createAnonymousUserRouter, getAnonymousUserRouter, getCurrentUserRouter, registerUserRouter } from "./user";
import { validatorsRouter } from "./validator";

const appHono = new Hono<AppEnv>();
appHono.use("*", otel());
appHono.use(
  "/*",
  cors({
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH", "OPTIONS"],
    origin: env.CORS_WEBSITE_URLS?.split(",") || ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
    exposeHeaders: ["cf-mitigated"]
  })
);

const scheduler = new Scheduler({
  healthchecksEnabled: env.HEALTHCHECKS_ENABLED === "true",
  errorHandler: (task, error) => {
    console.error(`Task "${task.name}" failed: ${error}`);
  }
});

appHono.use(container.resolve(HttpLoggerIntercepter).intercept());
appHono.use(container.resolve(RequestContextInterceptor).intercept());
appHono.use(container.resolve(AuthInterceptor).intercept());
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
  signAndBroadcastTxRouter,
  checkoutRouter,
  stripeWebhook,
  stripePricesRouter,
  stripeCouponsRouter,
  stripePaymentMethodsRouter,
  stripeTransactionsRouter,
  usageRouter,
  createAnonymousUserRouter,
  getAnonymousUserRouter,
  registerUserRouter,
  getCurrentUserRouter,
  sendVerificationEmailRouter,
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
  const tasksStatus = scheduler.getTasksStatus();
  const memoryInBytes = process.memoryUsage();
  const memory = {
    rss: bytesToHumanReadableSize(memoryInBytes.rss),
    heapTotal: bytesToHumanReadableSize(memoryInBytes.heapTotal),
    heapUsed: bytesToHumanReadableSize(memoryInBytes.heapUsed),
    external: bytesToHumanReadableSize(memoryInBytes.external)
  };

  return c.json({ version, memory, tasks: tasksStatus });
});

appHono.get("/v1/doc", c => {
  return c.json(container.resolve(OpenApiDocsService).generateDocs(openApiHonoHandlers));
});
appHono.get("/v1/swagger", swaggerUI({ url: "/v1/doc" }));

appHono.onError(container.resolve(HonoErrorHandlerService).handle);

container.register(APP_INITIALIZER, {
  useValue: {
    async [ON_APP_START]() {
      scheduler.start();
    }
  } satisfies AppInitializer
});

export { appHono as app, connectUsingSequelize as initDb };

export async function bootstrap(port: number) {
  await startServer(appHono, LoggerService.forContext("APP"), process, {
    port,
    beforeStart: migratePG
  });
}
