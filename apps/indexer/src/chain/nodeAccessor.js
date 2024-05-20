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
exports.nodeAccessor = void 0;
const fs_1 = __importDefault(require("fs"));
const constants_1 = require("@src/shared/constants");
const delay_1 = require("@src/shared/utils/delay");
const chainDefinitions_1 = require("@akashnetwork/cloudmos-shared/chainDefinitions");
const nodeInfo_1 = require("./nodeInfo");
const savedNodeInfoPath = constants_1.dataFolderPath + "/nodeStatus.json";
class NodeAccessor {
    constructor(settings) {
        this.settings = settings;
        this.nodes = chainDefinitions_1.activeChain.rpcNodes.map((x) => new nodeInfo_1.NodeInfo(x, settings.maxConcurrentQueryPerNode));
    }
    saveNodeStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("Saving node status...");
            const statuses = this.nodes.map((x) => x.getSavedNodeInfo());
            yield fs_1.default.promises.writeFile(savedNodeInfoPath, JSON.stringify(statuses, null, 2));
        });
    }
    refetchNodeStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            const promises = this.nodes.map((x) => x.updateStatus());
            yield Promise.allSettled(promises);
        });
    }
    loadNodeStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!fs_1.default.existsSync(savedNodeInfoPath)) {
                console.log("No saved node status found");
                yield this.refetchNodeStatus();
                yield this.saveNodeStatus();
                return;
            }
            console.log("Loading saved node status...");
            const file = yield fs_1.default.promises.readFile(savedNodeInfoPath, "utf-8");
            const savedNodes = JSON.parse(file);
            for (const savedNode of savedNodes) {
                const node = this.nodes.find((x) => x.url === savedNode.url);
                if (node) {
                    node.loadFromSavedNodeInfo(savedNode);
                }
            }
            setInterval(() => this.saveNodeStatus(), 30000);
        });
    }
    getBlock(height) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.fetch(`/block?height=${height}`, height);
        });
    }
    getBlockResult(height) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.fetch(`/block_results?height=${height}`, height);
        });
    }
    getLatestBlockHeight() {
        return __awaiter(this, void 0, void 0, function* () {
            const results = yield Promise.allSettled(this.nodes
                .filter((node) => node.status === nodeInfo_1.NodeStatus.OK)
                .map((node) => __awaiter(this, void 0, void 0, function* () {
                const response = yield node.query("/status");
                return parseInt(response.result.sync_info.latest_block_height);
            })));
            const validResults = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
            if (validResults.length === 0) {
                throw new Error("No active nodes");
            }
            const latestAvailableHeight = Math.max(...validResults);
            if (typeof latestAvailableHeight !== "number") {
                throw new Error("Invalid latest block height");
            }
            return latestAvailableHeight;
        });
    }
    waitForAvailableNode(height) {
        return __awaiter(this, void 0, void 0, function* () {
            while (!this.isNodeAvailable(height)) {
                yield (0, delay_1.sleep)(5);
            }
        });
    }
    waitForAllFinished() {
        return __awaiter(this, void 0, void 0, function* () {
            while (this.nodes.some((x) => x.activeQueries.length > 0)) {
                yield (0, delay_1.sleep)(5);
            }
        });
    }
    isNodeAvailable(height) {
        return !!this.getAvailableNode(height);
    }
    fetch(path, height) {
        return __awaiter(this, void 0, void 0, function* () {
            let node = this.getAvailableNode(height);
            if (!node)
                yield this.waitForAvailableNode(height);
            node = this.getAvailableNode(height);
            try {
                return yield node.query(path, height);
            }
            catch (err) {
                err.message = "[NodeAccessError] " + err.message;
                throw err;
            }
        });
    }
    getAvailableNode(height) {
        const availableNodes = this.nodes.filter((x) => x.isAvailable(height));
        if (availableNodes.length === 0)
            return null;
        const minActiveQueries = Math.min(...availableNodes.map((a, b) => a.activeQueries.length));
        const bestNodes = availableNodes.filter((x) => x.activeQueries.length === minActiveQueries);
        return bestNodes[Math.floor(Math.random() * bestNodes.length)];
    }
    getActiveNodeCount() {
        return this.nodes.filter((x) => x.status === nodeInfo_1.NodeStatus.OK).length;
    }
    getNodeStatus() {
        return this.nodes
            .sort((a, b) => a.url.localeCompare(b.url))
            .map((x) => ({
            endpoint: x.url,
            status: x.status,
            concurrent: x.maxConcurrentQuery,
            delay: x.delayBetweenRequests,
            earliest: x.earliestBlockHeight || null,
            fetching: x.activeQueries.map((x) => getQueryIdentifier(x)).join(","),
            success: x.successCount,
            failed: x.errorCount,
            latestError: x.latestError || null
        }));
    }
    displayTable() {
        console.table(this.getNodeStatus().map((x) => { var _a; return (Object.assign(Object.assign({}, x), { latestError: (_a = x.latestError) === null || _a === void 0 ? void 0 : _a.substring(0, 50) })); }));
    }
}
exports.nodeAccessor = new NodeAccessor({ maxConcurrentQueryPerNode: constants_1.concurrentNodeQuery });
function getQueryIdentifier(url) {
    if (url.startsWith("/block_results")) {
        return "r" + url.replace("/block_results?height=", "");
    }
    else if (url.startsWith("/block")) {
        return "b" + url.replace("/block?height=", "");
    }
    else {
        return url.substring(63);
    }
}
//# sourceMappingURL=nodeAccessor.js.map