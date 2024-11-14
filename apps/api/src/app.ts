import "reflect-metadata";
import "@src/core/providers/sentry.provider";

import { LoggerService } from "@akashnetwork/logging";
import { serve } from "@hono/node-server";
import { Context, Hono, Next } from "hono";
import { cors } from "hono/cors";
import { container } from "tsyringe";

import { config } from "@src/core/config";
import { getSentry, sentryOptions } from "@src/core/providers/sentry.provider";
import { HonoErrorHandlerService } from "@src/core/services/hono-error-handler/hono-error-handler.service";
import { HttpLoggerService } from "@src/core/services/http-logger/http-logger.service";
import { RequestContextInterceptor } from "@src/core/services/request-context-interceptor/request-context.interceptor";
import { HonoInterceptor } from "@src/core/types/hono-interceptor.type";
import packageJson from "../package.json";
import { chainDb, syncUserSchema, userDb } from "./db/dbConnection";
import { apiRouter } from "./routers/apiRouter";
import { dashboardRouter } from "./routers/dashboardRouter";
import { internalRouter } from "./routers/internalRouter";
import { legacyRouter } from "./routers/legacyRouter";
import { userRouter } from "./routers/userRouter";
import { web3IndexRouter } from "./routers/web3indexRouter";
import { env } from "./utils/env";
import { bytesToHumanReadableSize } from "./utils/files";
import { Scheduler } from "./scheduler";

const appHono = new Hono();
appHono.use(
  "/*",
  cors({
    origin: env.CORS_WEBSITE_URLS?.split(",") || ["http://localhost:3000", "http://localhost:3001"]
  })
);

const { PORT = 3080, BILLING_ENABLED } = process.env;

const scheduler = new Scheduler({
  healthchecksEnabled: env.HEALTHCHECKS_ENABLED === "true",
  errorHandler: (task, error) => {
    console.error(`Task "${task.name}" failed: ${error}`);
    getSentry().captureException(error);
  }
});

appHono.use(container.resolve(HttpLoggerService).intercept());
appHono.use(container.resolve(RequestContextInterceptor).intercept());
appHono.use("*", async (c: Context, next: Next) => {
  const { sentry } = await import("@hono/sentry");
  return sentry({
    ...sentryOptions,
    beforeSend: event => {
      event.server_name = config.SENTRY_SERVER_NAME;
      return event;
    }
  })(c, next);
});

appHono.route("/", legacyRouter);
appHono.route("/", apiRouter);
appHono.route("/user", userRouter);
appHono.route("/web3-index", web3IndexRouter);
appHono.route("/dashboard", dashboardRouter);
appHono.route("/internal", internalRouter);

// TODO: remove condition once billing is in prod
if (BILLING_ENABLED === "true") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { AuthInterceptor } = require("./auth/services/auth.interceptor");
  appHono.use(container.resolve<HonoInterceptor>(AuthInterceptor).intercept());
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { startTrialRouter, getWalletListRouter, signAndBroadcastTxRouter, checkoutRouter, stripeWebhook } = require("./billing");
  appHono.route("/", startTrialRouter);
  appHono.route("/", getWalletListRouter);
  appHono.route("/", signAndBroadcastTxRouter);
  appHono.route("/", checkoutRouter);
  appHono.route("/", stripeWebhook);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createAnonymousUserRouter, getAnonymousUserRouter } = require("./user");
  appHono.route("/", createAnonymousUserRouter);
  appHono.route("/", getAnonymousUserRouter);
}

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
    await initDb();
    startScheduler();

    appLogger.info({ event: "SERVER_STARTING", url: `http://localhost:${PORT}` });
    serve({
      fetch: appHono.fetch,
      port: typeof PORT === "string" ? parseInt(PORT) : PORT
    });
  } catch (error) {
    appLogger.error({ event: "APP_INIT_ERROR", error });
    getSentry().captureException(error);
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
