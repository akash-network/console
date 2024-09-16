import "@akashnetwork/env-loader";

import { activeChain, chainDefinitions } from "@akashnetwork/database/chainDefinitions";
import * as Sentry from "@sentry/node";
import express from "express";

import packageJson from "../package.json";
import { getSyncStatus, syncBlocks } from "./chain/chainSync";
import { getCacheSize } from "./chain/dataStore";
import { nodeAccessor } from "./chain/nodeAccessor";
import { statsProcessor } from "./chain/statsProcessor";
import { initDatabase } from "./db/buildDatabase";
import { fetchValidatorKeybaseInfos } from "./db/keybaseProvider";
import { syncPriceHistory } from "./db/priceHistoryProvider";
import { updateProvidersLocation } from "./providers/ipLocationProvider";
import { syncProvidersInfo } from "./providers/providerStatusProvider";
import { ExecutionMode, executionMode, isProd } from "./shared/constants";
import { sleep } from "./shared/utils/delay";
import { env } from "./shared/utils/env";
import { bytesToHumanReadableSize } from "./shared/utils/files";
import { updateProviderUptime } from "./tasks/providerUptimeTracker";
import { updateUsdSpending } from "./tasks/usdSpendingTracker";
import { addressBalanceMonitor, deploymentBalanceMonitor } from "./monitors";
import { Scheduler } from "./scheduler";

const app = express();

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

app.get("/status", async (req, res) => {
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

    res.send({ version, ...cacheSize, memory, activeNodeCount, tasks: tasksStatus, sync: syncStatus });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).send("An error occured");
  }
});

app.get("/nodes", async (req, res) => {
  try {
    const nodeStatus = nodeAccessor.getNodeStatus();
    res.send(nodeStatus);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).send("An error occured");
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
  scheduler.registerTask("Address Balance Monitor", () => addressBalanceMonitor.run(), "10 minutes");

  if (env.ACTIVE_CHAIN === "akash" || env.ACTIVE_CHAIN === "akashTestnet" || env.ACTIVE_CHAIN === "akashSandbox") {
    scheduler.registerTask("Sync Providers Info", syncProvidersInfo, "10 seconds", true, {
      id: env.HEALTHCHECKS_SYNC_PROVIDER_INFO,
      measureDuration: true
    });

    scheduler.registerTask("Deployment Balance Monitor", () => deploymentBalanceMonitor.run(), "10 minutes");
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
  try {
    if (env.STANDBY) {
      console.log("STANDBY mode enabled. Doing nothing.");
      // eslint-disable-next-line no-constant-condition
      while (true) {
        await sleep(5_000);
      }
    }

    if (!(process.env.ACTIVE_CHAIN in chainDefinitions)) {
      throw new Error(`Unknown chain with code: ${process.env.ACTIVE_CHAIN}`);
    }

    await initDatabase();
    await nodeAccessor.loadNodeStatus();

    if (executionMode === ExecutionMode.RebuildStats) {
      await statsProcessor.rebuildStatsTables();
    } else if (executionMode === ExecutionMode.RebuildAll) {
      console.time("Rebuilding all");
      await syncBlocks();
      console.timeEnd("Rebuilding all");
    } else if (executionMode === ExecutionMode.SyncOnly) {
      startScheduler();
    } else {
      throw "Invalid execution mode";
    }

    app.listen(PORT, () => {
      console.log("server started at http://localhost:" + PORT);
    });
  } catch (err) {
    console.error("Error while initializing app", err);

    Sentry.captureException(err);
  }
}

initApp();

export default app;
