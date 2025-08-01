import "reflect-metadata";

import { LoggerService } from "@akashnetwork/logging";
import { HttpLoggerIntercepter } from "@akashnetwork/logging/hono";
import { serve } from "@hono/node-server";
import { otel } from "@hono/otel";
import { swaggerUI } from "@hono/swagger-ui";
import { Hono } from "hono";
import { cors } from "hono/cors";
import once from "lodash/once";
import { container } from "tsyringe";

import { AuthInterceptor } from "@src/auth/services/auth.interceptor";
import { HonoErrorHandlerService } from "@src/core/services/hono-error-handler/hono-error-handler.service";
import type { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { OpenApiDocsService } from "@src/core/services/openapi-docs/openapi-docs.service";
import { RequestContextInterceptor } from "@src/core/services/request-context-interceptor/request-context.interceptor";
import { notificationsApiProxy } from "@src/notifications/routes/proxy/proxy.route";
import packageJson from "../package.json";
import { apiKeysRouter } from "./auth/routes/api-keys/api-keys.router";
import { bidsRouter } from "./bid/routes/bids/bids.router";
import { certificateRouter } from "./certificate/routes/certificate.router";
import { FeatureFlagsService } from "./core/services/feature-flags/feature-flags.service";
import { shutdownServer } from "./core/services/shutdown-server/shutdown-server";
import type { AppEnv } from "./core/types/app-context";
import { chainDb, syncUserSchema, userDb } from "./db/dbConnection";
import { deploymentSettingRouter } from "./deployment/routes/deployment-setting/deployment-setting.router";
import { deploymentsRouter } from "./deployment/routes/deployments/deployments.router";
import { leasesRouter } from "./deployment/routes/leases/leases.router";
import { healthzRouter } from "./healthz/routes/healthz.router";
import { clientInfoMiddleware } from "./middlewares/clientInfoMiddleware";
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
import { sendVerificationEmailRouter } from "./auth";
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
import { createAnonymousUserRouter, getAnonymousUserRouter } from "./user";
import { validatorsRouter } from "./validator";

const appHono = new Hono<AppEnv>();
appHono.use(
  "/*",
  cors({
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH", "OPTIONS"],
    origin: env.CORS_WEBSITE_URLS?.split(",") || ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
    exposeHeaders: ["cf-mitigated"]
  })
);
appHono.use("*", otel());

const { PORT = 3080 } = process.env;

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

function startScheduler() {
  scheduler.start();
}

const appLogger = LoggerService.forContext("APP");

/**
 * Initialize database
 * Start scheduler
 * Start server
 */
export async function initApp() {
  try {
    await Promise.all([initDb(), container.resolve(FeatureFlagsService).initialize()]);
    startScheduler();

    appLogger.info({ event: "SERVER_STARTING", url: `http://localhost:${PORT}`, NODE_OPTIONS: process.env.NODE_OPTIONS });
    const server = serve({
      fetch: appHono.fetch,
      port: typeof PORT === "string" ? parseInt(PORT, 10) : PORT
    });
    const shutdown = once(() => shutdownServer(server, appLogger, container.dispose.bind(container)));

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    appLogger.error({ event: "APP_INIT_ERROR", error });
  }
}

/**
 * Initialize database schema
 * Populate db
 * Create backups per version
 * Load from backup if exists for current version
 */
export async function initDb() {
  appLogger.debug(`Connecting to chain database (${chainDb.config.host}/${chainDb.config.database})...`);
  await chainDb.authenticate();
  appLogger.debug("Connection has been established successfully.");

  appLogger.debug(`Connecting to user database (${userDb.config.host}/${userDb.config.database})...`);
  await userDb.authenticate();
  appLogger.debug("Connection has been established successfully.");

  appLogger.debug("Sync user schema...");
  await syncUserSchema();
  appLogger.debug("User schema synced.");
}

export { appHono as app };
