import express from "express";
import cors from "cors";
import packageJson from "../package.json";
import { isProd } from "./utils/constants";
import * as Sentry from "@sentry/node";
import { Scheduler } from "./scheduler";
import { apiRouter, apiRouterHono } from "./routers/apiRouter";
import { userRouter } from "./routers/userRouter";
import { web3IndexRouter } from "./routers/web3indexRouter";
import { bytesToHumanReadableSize } from "./utils/files";
import { env } from "./utils/env";
import { chainDb, syncUserSchema, userDb } from "./db/dbConnection";
import { dashboardRouter } from "./routers/dashboardRouter";
import { Hono } from "hono";
import { serve } from "@hono/node-server";

const app = express();
app.use(
  cors({
    origin: env.AKASHLYTICS_CORS_WEBSITE_URLS?.split(",") || ["http://localhost:3000", "http://localhost:3001"],
    optionsSuccessStatus: 200
  })
);

const appHono = new Hono();

const { PORT = 3080 } = process.env;

Sentry.init({
  dsn: env.SentryDSN,
  environment: env.NODE_ENV,
  serverName: env.SentryServerName,
  release: packageJson.version,
  enabled: isProd,
  integrations: [
    // enable HTTP calls tracing
    new Sentry.Integrations.Http({ tracing: true }),
    // enable Express.js middleware tracing
    new Sentry.Integrations.Express({
      // to trace all requests to the default router
      app
      // alternatively, you can specify the routes you want to trace:
      // router: someRouter,
    })
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

// RequestHandler creates a separate execution context using domains, so that every
// transaction/span/breadcrumb is attached to its own Hub instance
app.use(Sentry.Handlers.requestHandler());
// TracingHandler creates a trace for every incoming request
app.use(Sentry.Handlers.tracingHandler());

app.use("/", apiRouter);
app.use("/user", userRouter);
app.use("/web3-index", web3IndexRouter);
appHono.route("/dashboard", dashboardRouter);

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

appHono.route("/", apiRouterHono);

// The error handler must be before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

function startScheduler() {
  scheduler.start();
}

/**
 * Intizialize database schema
 * Populate db
 * Create backups per version
 * Load from backup if exists for current version
 */
async function initApp() {
  try {
    console.log(`Connecting to chain database (${chainDb.config.host}/${chainDb.config.database})...`);
    await chainDb.authenticate();
    console.log("Connection has been established successfully.");

    console.log(`Connecting to user database (${userDb.config.host}/${userDb.config.database})...`);
    await userDb.authenticate();
    console.log("Connection has been established successfully.");

    console.log("Sync user schema...");
    await syncUserSchema();
    console.log("User schema synced.");

    startScheduler();

    app.listen(PORT, () => {
      console.log("server started at http://localhost:" + PORT);
    });

    serve({
      fetch: appHono.fetch,
      port: 8787
    });
  } catch (err) {
    console.error("Error while initializing app", err);

    Sentry.captureException(err);
  }
}

initApp();

export default app;
