"use strict";
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
exports.NodeInfo = exports.NodeStatus = void 0;
const delay_1 = require("@src/shared/utils/delay");
const axios_1 = __importDefault(require("axios"));
const RateLimitWaitingPeriod = 2 * 60000; // 2 minutes
const LateNodeWaitingPeriod = 5 * 60000; // 5 minutes
const UnavailableShortWaitingPeriod = 1 * 60000; // 1 minutes
const UnavailableLongWaitingPeriod = 5 * 60000; // 5 minutes
const LateNodeThreshold = 2;
const QueryTimeout = 60000; // 60 seconds
var HttpCodes;
(function (HttpCodes) {
    HttpCodes[HttpCodes["TOO_MANY_REQUESTS"] = 429] = "TOO_MANY_REQUESTS";
})(HttpCodes || (HttpCodes = {}));
var NodeStatus;
(function (NodeStatus) {
    NodeStatus["OK"] = "OK";
    NodeStatus["UNAVAILABLE"] = "UNAVAILABLE";
    NodeStatus["UNKNOWN"] = "UNKNOWN";
    NodeStatus["RATE_LIMIT"] = "RATE_LIMIT";
    NodeStatus["LATE"] = "LATE";
})(NodeStatus = exports.NodeStatus || (exports.NodeStatus = {}));
class NodeInfo {
    constructor(url, maxConcurrentQuery) {
        this.url = url;
        this.activeQueries = [];
        this.successCount = 0;
        this.errorCount = 0;
        this.status = NodeStatus.UNKNOWN;
        this.earliestBlockHeight = undefined;
        this.maxConcurrentQuery = maxConcurrentQuery;
        this.delayBetweenRequests = 0;
    }
    getSavedNodeInfo() {
        return {
            url: this.url,
            status: this.status,
            maxConcurrentQuery: this.maxConcurrentQuery,
            delayBetweenRequests: this.delayBetweenRequests,
            earliestBlockHeight: this.earliestBlockHeight
        };
    }
    loadFromSavedNodeInfo(savedNodeInfo) {
        this.status = savedNodeInfo.status;
        this.maxConcurrentQuery = savedNodeInfo.maxConcurrentQuery;
        this.delayBetweenRequests = savedNodeInfo.delayBetweenRequests;
        this.earliestBlockHeight = savedNodeInfo.earliestBlockHeight;
        switch (this.status) {
            case NodeStatus.RATE_LIMIT:
                setTimeout(() => {
                    this.updateStatus();
                }, RateLimitWaitingPeriod);
                break;
            case NodeStatus.LATE:
                setTimeout(() => {
                    this.updateStatus();
                }, LateNodeWaitingPeriod);
                break;
            case NodeStatus.UNAVAILABLE:
                this.handleUnavailable();
                break;
            case NodeStatus.UNKNOWN:
                this.updateStatus();
                break;
        }
    }
    handleUnavailable() {
        return __awaiter(this, void 0, void 0, function* () {
            setTimeout(() => {
                this.updateStatus();
            }, this.successCount > 50 ? UnavailableShortWaitingPeriod : UnavailableLongWaitingPeriod);
        });
    }
    updateStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            return axios_1.default
                .get(`${this.url}/status`, { timeout: QueryTimeout })
                .then((res) => {
                this.status = NodeStatus.OK;
                this.earliestBlockHeight = parseInt(res.data.result.sync_info.earliest_block_height);
            })
                .catch((err) => {
                var _a;
                this.status = NodeStatus.UNAVAILABLE;
                this.latestError = err.message || "Unknown error";
                if (((_a = err.response) === null || _a === void 0 ? void 0 : _a.status) === HttpCodes.TOO_MANY_REQUESTS) {
                    this.handleRateLimiting();
                }
                else {
                    this.handleUnavailable();
                }
            });
        });
    }
    isAvailable(height) {
        return this.status === NodeStatus.OK && (!height || this.earliestBlockHeight <= height) && this.activeQueries.length < this.maxConcurrentQuery;
    }
    handleRateLimiting() {
        this.status = NodeStatus.RATE_LIMIT;
        if (!this.lastErrorDate || new Date().getTime() - this.lastErrorDate.getTime() > 60000) {
            if (this.maxConcurrentQuery > 1) {
                this.maxConcurrentQuery--;
            }
            else {
                this.delayBetweenRequests += 500;
                if (this.delayBetweenRequests > 5000) {
                    this.status = NodeStatus.UNAVAILABLE;
                }
            }
            setTimeout(() => {
                this.updateStatus();
            }, RateLimitWaitingPeriod);
        }
    }
    handleMissingBlock(requestedHeight, latestHeight) {
        if (requestedHeight - latestHeight <= LateNodeThreshold)
            return;
        if (!this.lastErrorDate || new Date().getTime() - this.lastErrorDate.getTime() > LateNodeWaitingPeriod) {
            this.status = NodeStatus.LATE;
            setTimeout(() => {
                this.updateStatus();
            }, LateNodeWaitingPeriod);
        }
    }
    query(path, height) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function* () {
            this.activeQueries.push(path);
            if (this.delayBetweenRequests && this.lastQueryDate) {
                const msDiff = new Date().getTime() - this.lastQueryDate.getTime();
                if (msDiff < this.delayBetweenRequests) {
                    yield (0, delay_1.sleep)(this.delayBetweenRequests - msDiff);
                }
            }
            try {
                const response = yield axios_1.default.get(`${this.url}${path}`, { timeout: QueryTimeout });
                this.successCount++;
                return response.data;
            }
            catch (err) {
                const rpcError = (_c = (_b = (_a = err.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.error) === null || _c === void 0 ? void 0 : _c.data;
                let error = err.message || "Unknown error";
                if (((_d = err.response) === null || _d === void 0 ? void 0 : _d.status) === HttpCodes.TOO_MANY_REQUESTS) {
                    this.handleRateLimiting();
                }
                else if (height && rpcError) {
                    if (/^height \d+ must be less than or equal to the current blockchain height \d+$/i.test(rpcError)) {
                        error = "Block was missing";
                        this.handleMissingBlock(height, parseInt(/blockchain height (\d+)$/i.exec(rpcError)[1]));
                    }
                    else if (/^height \d+ is not available, lowest height is \d+$/i.test(rpcError)) {
                        error = "Block was pruned";
                        this.earliestBlockHeight = parseInt(/lowest height is (\d+)$/i.exec(rpcError)[1]);
                    }
                }
                else {
                    this.status = NodeStatus.UNAVAILABLE;
                    this.handleUnavailable();
                }
                this.errorCount++;
                this.latestError = error;
                this.lastErrorDate = new Date();
                this.errorCount++;
                throw err;
            }
            finally {
                this.activeQueries = this.activeQueries.filter((x) => x !== path);
                this.lastQueryDate = new Date();
            }
        });
    }
}
exports.NodeInfo = NodeInfo;
//# sourceMappingURL=nodeInfo.js.map