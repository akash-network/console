"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.concurrentNodeQuery = exports.dataFolderPath = exports.lastBlockToSync = exports.executionMode = exports.ExecutionMode = exports.isProd = exports.averageBlockCountInAMonth = exports.averageHoursInAMonth = exports.averageDaysInMonth = exports.averageBlockTime = void 0;
const chainDefinitions_1 = require("@akashnetwork/cloudmos-shared/chainDefinitions");
const env_1 = require("./utils/env");
const path_1 = __importDefault(require("path"));
exports.averageBlockTime = 6.174;
exports.averageDaysInMonth = 30.437;
exports.averageHoursInAMonth = exports.averageDaysInMonth * 24;
exports.averageBlockCountInAMonth = (exports.averageDaysInMonth * 24 * 60 * 60) / exports.averageBlockTime;
exports.isProd = env_1.env.NODE_ENV === "production";
var ExecutionMode;
(function (ExecutionMode) {
    ExecutionMode[ExecutionMode["DoNotSync"] = 0] = "DoNotSync";
    ExecutionMode[ExecutionMode["SyncOnly"] = 1] = "SyncOnly";
    ExecutionMode[ExecutionMode["RebuildStats"] = 2] = "RebuildStats";
    ExecutionMode[ExecutionMode["RebuildAll"] = 3] = "RebuildAll";
})(ExecutionMode = exports.ExecutionMode || (exports.ExecutionMode = {}));
exports.executionMode = ExecutionMode.SyncOnly;
exports.lastBlockToSync = Number.POSITIVE_INFINITY;
exports.dataFolderPath = path_1.default.join(env_1.env.DataFolder, chainDefinitions_1.activeChain.code);
exports.concurrentNodeQuery = 5;
//# sourceMappingURL=constants.js.map