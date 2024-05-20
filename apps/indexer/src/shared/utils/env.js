"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.env = {
    HealthChecks_SyncBlocks: process.env.HealthChecks_SyncBlocks,
    HealthChecks_SyncAKTPriceHistory: process.env.HealthChecks_SyncAKTPriceHistory,
    HealthChecks_SyncProviderInfo: process.env.HealthChecks_SyncProviderInfo,
    HealthChecks_SyncKeybaseInfo: process.env.HealthChecks_SyncKeybaseInfo,
    SentryDSN: process.env.SentryDSN,
    NODE_ENV: process.env.NODE_ENV,
    SentryServerName: process.env.SentryServerName,
    HealthchecksEnabled: process.env.HealthchecksEnabled,
    AkashDatabaseCS: process.env.AkashDatabaseCS,
    PassageDatabaseCS: process.env.PassageDatabaseCS,
    JunoDatabaseCS: process.env.JunoDatabaseCS,
    ActiveChain: process.env.ActiveChain,
    KeepCache: process.env.KeepCache === "true",
    Standby: process.env.Standby === "true",
    DataFolder: (_a = process.env.DataFolder) !== null && _a !== void 0 ? _a : "./data"
};
//# sourceMappingURL=env.js.map