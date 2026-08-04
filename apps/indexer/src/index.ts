import "@akashnetwork/env-loader";

import { activeChain, chainDefinitions } from "@akashnetwork/database/chainDefinitions";
import * as Sentry from "@sentry/node";
import { Hono } from "hono";
import { setTimeout as sleep } from "node:timers/promises";

import packageJson from "../package.json";
import { getSyncStatus, syncBlocks } from "./chain/chainSync";
import { closeCaches, getCacheSize } from "./chain/dataStore";
import { nodeAccessor } from "./chain/nodeAccessor";
import { statsProcessor } from "./chain/statsProcessor";
import { initDatabase } from "./db/buildDatabase";
import { sequelize } from "./db/dbConnection";
import { fetchValidatorKeybaseInfos } from "./db/keybaseProvider";
import { syncPriceHistory } from "./db/priceHistoryProvider";
import { startServer } from "./lib/start-server/start-server";
import { updateProvidersLocation } from "./providers/ipLocationProvider";
import { syncProvidersInfo } from "./providers/providerStatusProvider";
import { ExecutionMode, executionMode, isProd } from "./shared/constants";
import { env } from "./shared/utils/env";
import { bytesToHumanReadableSize } from "./shared/utils/files";
import { updateProviderUptime } from "./tasks/providerUptimeTracker";
import { updateUsdSpending } from "./tasks/usdSpendingTracker";
import { Scheduler } from "./scheduler";

const app = new Hono();

const { PORT = 3079 } = process.env;

Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV,
  serverName: env.SENTRY_SERVER_NAME,
  release: packageJson.version,
  enabled: isProd,
  integrations: [],
  ignoreErrors: ["[NodeAccessError]"],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 0.01
});

Sentry.setTag("chain", env.ACTIVE_CHAIN);

const scheduler = new Scheduler({
  healthchecksEnabled: env.HEALTH_CHECKS_ENABLED === "true",
  errorHandler: (task, error) => {
    console.error(`Task "${task.name}" failed: `, error);
    Sentry.captureException(error, { tags: { task: task.name } });
  }
});

interface AcquiredResource {
  name: string;
  dispose: () => Promise<void> | void;
}

const acquiredResources: AcquiredResource[] = [];

function disposeOnShutdown(resource: AcquiredResource) {
  acquiredResources.push(resource);
}

/** Disposes in reverse acquisition order so producers stop before the stores they write to are closed. */
async function disposeAcquiredResources() {
  for (const resource of [...acquiredResources].reverse()) {
    try {
      await resource.dispose();
      console.log(`Disposed "${resource.name}"`);
    } catch (error) {
      console.error(`Failed to dispose "${resource.name}"`, error);
      Sentry.captureException(error);
    }
  }
}

app.get("/status", async (c) => {
  try {
    const version = packageJson.version;
    const tasksStatus = scheduler.getTasksStatus();
    const syncStatus = await getSyncStatus();
    const cacheSize = await getCacheSize();
    const memoryInBytes = process.memoryUsage();
    const activeNodeCount = nodeAccessor.getActiveNodeCount();
    const memory = {
      rss: bytesToHumanReadableSize(memoryInBytes.rss),
      heapTotal: bytesToHumanReadableSize(memoryInBytes.heapTotal),
      heapUsed: bytesToHumanReadableSize(memoryInBytes.heapUsed),
      external: bytesToHumanReadableSize(memoryInBytes.external)
    };

    return c.json({ version, ...cacheSize, memory, activeNodeCount, tasks: tasksStatus, sync: syncStatus });
  } catch (err) {
    Sentry.captureException(err);
    return c.text("An error occurred", 500);
  }
});

app.get("/nodes", async c => {
  try {
    const nodeStatus = nodeAccessor.getNodeStatus();
    return c.json(nodeStatus);
  } catch (err) {
    Sentry.captureException(err);
    return c.text("An error occurred", 500);
  }
});

function startScheduler() {
  scheduler.registerTask("Sync Blocks", syncBlocks, "7 seconds", true, {
    id: env.HEALTHCHECKS_SYNC_BLOCKS
  });
  scheduler.registerTask("Sync Price History", syncPriceHistory, "1 hour", true, {
    id: env.HEALTHCHECKS_SYNC_AKT_PRICE_HISTORY,
    measureDuration: true
  });

  if (env.ACTIVE_CHAIN === "akash" || env.ACTIVE_CHAIN === "akashTestnet" || env.ACTIVE_CHAIN === "akashSandbox") {
    scheduler.registerTask("Sync Providers Info", syncProvidersInfo, "10 seconds", true, {
      id: env.HEALTHCHECKS_SYNC_PROVIDER_INFO,
      measureDuration: true
    });

    scheduler.registerTask("Provider IP Lookup", () => updateProvidersLocation(), "30 minutes", true);
    scheduler.registerTask("USD Spending Tracker", () => updateUsdSpending(), "1 minute", true);
    scheduler.registerTask("Update provider uptime", () => updateProviderUptime(), "10 minutes", true);
  }

  if (!activeChain.startHeight) {
    scheduler.registerTask("Sync Keybase Info", fetchValidatorKeybaseInfos, "6 hours", true, {
      id: env.HEALTHCHECKS_SYNC_KEYBASE_INFO,
      measureDuration: true
    });
  }

  scheduler.start();
}

/**
 * Initialize database schema
 * Populate db
 * Create backups per version
 * Load from backup if exists for current version
 */
async function initApp() {
  if (env.STANDBY) {
    console.log("STANDBY mode enabled. Doing nothing.");

    while (true) {
      await sleep(5_000);
    }
  }

  const activeChainCode = process.env.ACTIVE_CHAIN;
  if (!activeChainCode || !(activeChainCode in chainDefinitions)) {
    throw new Error(`Unknown chain with code: ${process.env.ACTIVE_CHAIN}`);
  }

  await initDatabase();
  disposeOnShutdown({ name: "database", dispose: () => sequelize.close() });
  disposeOnShutdown({ name: "block cache", dispose: () => closeCaches() });

  await nodeAccessor.loadNodeStatus();
  disposeOnShutdown({ name: "node accessor", dispose: () => nodeAccessor.stop() });

  if (executionMode === ExecutionMode.RebuildStats) {
    await statsProcessor.rebuildStatsTables();
  } else if (executionMode === ExecutionMode.RebuildAll) {
    console.time("Rebuilding all");
    await syncBlocks();
    console.timeEnd("Rebuilding all");
  } else if (executionMode === ExecutionMode.SyncOnly) {
    startScheduler();
    disposeOnShutdown({ name: "scheduler", dispose: () => scheduler.stop() });
  } else {
    throw "Invalid execution mode";
  }
}

startServer(app, console, process, {
  port: Number(PORT),
  beforeStart: initApp,
  onStop: disposeAcquiredResources
}).catch(error => {
  console.error("Error while initializing app", error);
  Sentry.captureException(error);
});

export default app;
