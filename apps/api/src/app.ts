import { serve } from "@hono/node-server";
// TODO: find out how to properly import this
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import { sentry } from "@hono/sentry";
import * as Sentry from "@sentry/node";
import { Hono } from "hono";
import { cors } from "hono/cors";

import packageJson from "../package.json";
import { chainDb, syncUserSchema, userDb } from "./db/dbConnection";
import { apiRouter } from "./routers/apiRouter";
import { dashboardRouter } from "./routers/dashboardRouter";
import { internalRouter } from "./routers/internalRouter";
import { legacyRouter } from "./routers/legacyRouter";
import { userRouter } from "./routers/userRouter";
import { web3IndexRouter } from "./routers/web3indexRouter";
import { isProd } from "./utils/constants";
import { env } from "./utils/env";
import { bytesToHumanReadableSize } from "./utils/files";
import { Scheduler } from "./scheduler";

const appHono = new Hono();
appHono.use(
  "/*",
  cors({
    origin: env.AKASHLYTICS_CORS_WEBSITE_URLS?.split(",") || ["http://localhost:3000", "http://localhost:3001"]
  })
);

const { PORT = 3080 } = process.env;

Sentry.init({
  dsn: env.SentryDSN,
  environment: env.NODE_ENV,
  serverName: env.SentryServerName,
  release: packageJson.version,
  enabled: isProd,
  integrations: [
    // enable HTTP calls tracing
    new Sentry.Integrations.Http({ tracing: true })
  ],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 0.01
});

const scheduler = new Scheduler({
  healthchecksEnabled: env.HealthchecksEnabled === "true",
  errorHandler: (task, error) => {
    console.error(`Task "${task.name}" failed: ${error}`);
    Sentry.captureException(error);
  }
});

appHono.use(
  "*",
  sentry({
    dsn: env.SentryDSN,
    environment: env.NODE_ENV,
    beforeSend: (event) => {
      event.server_name = env.SentryServerName;
      return event;
    },
    tracesSampleRate: 0.01,
    release: packageJson.version,
    enabled: isProd
  })
);

appHono.route("/", legacyRouter);
appHono.route("/", apiRouter);
appHono.route("/user", userRouter);
appHono.route("/web3-index", web3IndexRouter);
appHono.route("/dashboard", dashboardRouter);
appHono.route("/internal", internalRouter);

appHono.get("/status", (c) => {
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

function startScheduler() {
  scheduler.start();
}

/**
 * Initialize database
 * Start scheduler
 * Start server
 */
export async function initApp() {
  try {
    await initDb();
    startScheduler();

    console.log("Starting server at http://localhost:" + PORT);
    serve({
      fetch: appHono.fetch,
      port: typeof PORT === "string" ? parseInt(PORT) : PORT
    });
  } catch (err) {
    console.error("Error while initializing app", err);

    Sentry.captureException(err);
  }
}

/**
 * Initialize database schema
 * Populate db
 * Create backups per version
 * Load from backup if exists for current version
 */
export async function initDb(options: { log?: boolean } = { log: true }) {
  const log = (value: string) => options?.log && console.log(value);

  log(`Connecting to chain database (${chainDb.config.host}/${chainDb.config.database})...`);
  await chainDb.authenticate();
  log("Connection has been established successfully.");

  log(`Connecting to user database (${userDb.config.host}/${userDb.config.database})...`);
  await userDb.authenticate();
  log("Connection has been established successfully.");

  log("Sync user schema...");
  await syncUserSchema();
  log("User schema synced.");
}

export { appHono as app };
