"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const package_json_1 = __importDefault(require("../package.json"));
const buildDatabase_1 = require("./db/buildDatabase");
const priceHistoryProvider_1 = require("./db/priceHistoryProvider");
const chainSync_1 = require("./chain/chainSync");
const constants_1 = require("./shared/constants");
const Sentry = __importStar(require("@sentry/node"));
const statsProcessor_1 = require("./chain/statsProcessor");
const providerStatusProvider_1 = require("./providers/providerStatusProvider");
const scheduler_1 = require("./scheduler");
const keybaseProvider_1 = require("./db/keybaseProvider");
const files_1 = require("./shared/utils/files");
const dataStore_1 = require("./chain/dataStore");
const env_1 = require("./shared/utils/env");
const nodeAccessor_1 = require("./chain/nodeAccessor");
const chainDefinitions_1 = require("@akashnetwork/cloudmos-shared/chainDefinitions");
const monitors_1 = require("./monitors");
const ipLocationProvider_1 = require("./providers/ipLocationProvider");
const delay_1 = require("./shared/utils/delay");
const usdSpendingTracker_1 = require("./tasks/usdSpendingTracker");
const providerUptimeTracker_1 = require("./tasks/providerUptimeTracker");
const app = (0, express_1.default)();
const { PORT = 3079 } = process.env;
Sentry.init({
    dsn: env_1.env.SentryDSN,
    environment: env_1.env.NODE_ENV,
    serverName: env_1.env.SentryServerName,
    release: package_json_1.default.version,
    enabled: constants_1.isProd,
    integrations: [],
    ignoreErrors: ["[NodeAccessError]"],
    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 0.01
});
Sentry.setTag("chain", env_1.env.ActiveChain);
const scheduler = new scheduler_1.Scheduler({
    healthchecksEnabled: env_1.env.HealthchecksEnabled === "true",
    errorHandler: (task, error) => {
        console.error(`Task "${task.name}" failed: `, error);
        Sentry.captureException(error, { tags: { task: task.name } });
    }
});
app.get("/status", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const version = package_json_1.default.version;
        const tasksStatus = scheduler.getTasksStatus();
        const syncStatus = yield (0, chainSync_1.getSyncStatus)();
        const cacheSize = yield (0, dataStore_1.getCacheSize)();
        const memoryInBytes = process.memoryUsage();
        const activeNodeCount = nodeAccessor_1.nodeAccessor.getActiveNodeCount();
        const memory = {
            rss: (0, files_1.bytesToHumanReadableSize)(memoryInBytes.rss),
            heapTotal: (0, files_1.bytesToHumanReadableSize)(memoryInBytes.heapTotal),
            heapUsed: (0, files_1.bytesToHumanReadableSize)(memoryInBytes.heapUsed),
            external: (0, files_1.bytesToHumanReadableSize)(memoryInBytes.external)
        };
        res.send(Object.assign(Object.assign({ version }, cacheSize), { memory, activeNodeCount, tasks: tasksStatus, sync: syncStatus }));
    }
    catch (err) {
        Sentry.captureException(err);
        res.status(500).send("An error occured");
    }
}));
app.get("/nodes", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const nodeStatus = nodeAccessor_1.nodeAccessor.getNodeStatus();
        res.send(nodeStatus);
    }
    catch (err) {
        Sentry.captureException(err);
        res.status(500).send("An error occured");
    }
}));
function startScheduler() {
    scheduler.registerTask("Sync Blocks", chainSync_1.syncBlocks, "7 seconds", true, {
        id: env_1.env.HealthChecks_SyncBlocks
    });
    scheduler.registerTask("Sync Price History", priceHistoryProvider_1.syncPriceHistory, "1 hour", true, {
        id: env_1.env.HealthChecks_SyncAKTPriceHistory,
        measureDuration: true
    });
    scheduler.registerTask("Address Balance Monitor", () => monitors_1.addressBalanceMonitor.run(), "10 minutes");
    if (env_1.env.ActiveChain === "akash" || env_1.env.ActiveChain === "akashTestnet" || env_1.env.ActiveChain === "akashSandbox") {
        scheduler.registerTask("Sync Providers Info", providerStatusProvider_1.syncProvidersInfo, "10 seconds", true, {
            id: env_1.env.HealthChecks_SyncProviderInfo,
            measureDuration: true
        });
        scheduler.registerTask("Deployment Balance Monitor", () => monitors_1.deploymentBalanceMonitor.run(), "10 minutes");
        scheduler.registerTask("Provider IP Lookup", () => (0, ipLocationProvider_1.updateProvidersLocation)(), "30 minutes", true);
        scheduler.registerTask("USD Spending Tracker", () => (0, usdSpendingTracker_1.updateUsdSpending)(), "1 minute", true);
        scheduler.registerTask("Update provider uptime", () => (0, providerUptimeTracker_1.updateProviderUptime)(), "10 minutes", true);
    }
    if (!chainDefinitions_1.activeChain.startHeight) {
        scheduler.registerTask("Sync Keybase Info", keybaseProvider_1.fetchValidatorKeybaseInfos, "6 hours", true, {
            id: env_1.env.HealthChecks_SyncKeybaseInfo,
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
function initApp() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (env_1.env.Standby) {
                console.log("Standby mode enabled. Doing nothing.");
                while (true) {
                    yield (0, delay_1.sleep)(5000);
                }
            }
            if (!(process.env.ActiveChain in chainDefinitions_1.chainDefinitions)) {
                throw new Error(`Unknown chain with code: ${process.env.ActiveChain}`);
            }
            yield (0, buildDatabase_1.initDatabase)();
            yield nodeAccessor_1.nodeAccessor.loadNodeStatus();
            if (constants_1.executionMode === constants_1.ExecutionMode.RebuildStats) {
                yield statsProcessor_1.statsProcessor.rebuildStatsTables();
            }
            else if (constants_1.executionMode === constants_1.ExecutionMode.RebuildAll) {
                console.time("Rebuilding all");
                yield (0, chainSync_1.syncBlocks)();
                console.timeEnd("Rebuilding all");
            }
            else if (constants_1.executionMode === constants_1.ExecutionMode.SyncOnly) {
                startScheduler();
            }
            else {
                throw "Invalid execution mode";
            }
            app.listen(PORT, () => {
                console.log("server started at http://localhost:" + PORT);
            });
        }
        catch (err) {
            console.error("Error while initializing app", err);
            Sentry.captureException(err);
        }
    });
}
initApp();
exports.default = app;
//# sourceMappingURL=index.js.map