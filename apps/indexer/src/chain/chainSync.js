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
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncBlocks = exports.getSyncStatus = exports.setMissingBlock = void 0;
const statsProcessor_1 = require("./statsProcessor");
const dataStore_1 = require("./dataStore");
const nodeAccessor_1 = require("./nodeAccessor");
const js_sha256_1 = require("js-sha256");
const constants_1 = require("@src/shared/constants");
const date_fns_1 = require("date-fns");
const benchmark = __importStar(require("../shared/utils/benchmark"));
const uuid = __importStar(require("uuid"));
const async_1 = require("async");
const dbConnection_1 = require("@src/db/dbConnection");
const chainDefinitions_1 = require("@akashnetwork/cloudmos-shared/chainDefinitions");
const base_1 = require("@akashnetwork/cloudmos-shared/dbSchemas/base");
const dbSchemas_1 = require("@akashnetwork/cloudmos-shared/dbSchemas");
const env_1 = require("@src/shared/utils/env");
const sequelize_1 = require("sequelize");
const proto_signing_1 = require("@cosmjs/proto-signing");
const encoding_1 = require("@cosmjs/encoding");
const setMissingBlock = (height) => (missingBlock = height);
exports.setMissingBlock = setMissingBlock;
let missingBlock;
function getSyncStatus() {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const latestHeightInCacheRequest = (0, dataStore_1.getLatestHeightInCache)();
        const latestHeightInDbRequest = dbSchemas_1.Block.max("height");
        const latestProcessedHeightRequest = dbSchemas_1.Block.max("height", { where: { isProcessed: true } });
        const realLatestNotificationProcessedHeightRequest = dbSchemas_1.Message.max("height", { where: { isNotificationProcessed: true } });
        const [latestHeightInCache, latestHeightInDb, latestProcessedHeight, realLatestNotificationProcessedHeight] = yield Promise.all([
            latestHeightInCacheRequest,
            latestHeightInDbRequest,
            latestProcessedHeightRequest,
            realLatestNotificationProcessedHeightRequest
        ]);
        const firstNotificationUnprocessedMessage = (_a = (yield dbSchemas_1.Message.findOne({
            include: [
                {
                    model: base_1.Transaction,
                    where: { hasProcessingError: false }
                }
            ],
            where: { isNotificationProcessed: false, height: { [sequelize_1.Op.gte]: realLatestNotificationProcessedHeight !== null && realLatestNotificationProcessedHeight !== void 0 ? realLatestNotificationProcessedHeight : 0 } },
            order: [["height", "ASC"]]
        }))) === null || _a === void 0 ? void 0 : _a.height;
        const latestDateInDb = latestHeightInDb ? (yield dbSchemas_1.Block.findOne({ where: { height: latestHeightInDb } })).datetime : null;
        const latestProcessedDateInDb = latestProcessedHeight ? (yield dbSchemas_1.Block.findOne({ where: { height: latestProcessedHeight } })).datetime : null;
        const latestNotificationProcessedHeight = firstNotificationUnprocessedMessage ? firstNotificationUnprocessedMessage - 1 : latestHeightInDb;
        const latestNotificationProcessedDateInDb = !chainDefinitions_1.activeChain.startHeight || latestNotificationProcessedHeight > chainDefinitions_1.activeChain.startHeight
            ? (yield dbSchemas_1.Block.findOne({ where: { height: latestNotificationProcessedHeight } })).datetime
            : null;
        return {
            latestHeightInCache,
            latestHeightInDb,
            latestDateInDb,
            isInsertLate: latestDateInDb && (0, date_fns_1.differenceInSeconds)(new Date(), latestDateInDb) > 60,
            latestProcessedHeight,
            latestProcessedDateInDb,
            isProcessingLate: latestProcessedDateInDb && (0, date_fns_1.differenceInSeconds)(new Date(), latestProcessedDateInDb) > 60,
            latestNotificationProcessedHeight,
            latestNotificationProcessedDateInDb,
            isNotificationProcessingLate: latestNotificationProcessedDateInDb && (0, date_fns_1.differenceInSeconds)(new Date(), latestNotificationProcessedDateInDb) > 60
        };
    });
}
exports.getSyncStatus = getSyncStatus;
function syncBlocks() {
    return __awaiter(this, void 0, void 0, function* () {
        const latestAvailableHeight = yield nodeAccessor_1.nodeAccessor.getLatestBlockHeight();
        let latestBlockToDownload = Math.min(constants_1.lastBlockToSync, latestAvailableHeight);
        const latestInsertedHeight = (yield dbSchemas_1.Block.max("height")) || 0;
        const latestHeightInCache = yield (0, dataStore_1.getLatestHeightInCache)();
        if (latestHeightInCache >= latestBlockToDownload) {
            console.log("No blocks to download");
        }
        else {
            let startHeight = !env_1.env.KeepCache ? latestInsertedHeight + 1 : Math.max(latestHeightInCache, 1);
            // If database is empty
            if (latestInsertedHeight === 0) {
                console.log("Starting from scratch");
                startHeight = chainDefinitions_1.activeChain.startHeight || 1;
            }
            // If there was a missing block
            if (missingBlock) {
                startHeight = Math.min(missingBlock, latestBlockToDownload);
                missingBlock = null;
            }
            const maxDownloadGroupSize = 1000;
            if (latestBlockToDownload - startHeight > maxDownloadGroupSize) {
                console.log("Limiting download to " + maxDownloadGroupSize + " blocks");
                latestBlockToDownload = startHeight + maxDownloadGroupSize;
            }
            console.log("Starting download at block #" + startHeight);
            console.log("Will end download at block #" + latestBlockToDownload);
            console.log(latestBlockToDownload - startHeight + 1 + " blocks to download");
            yield benchmark.measureAsync("downloadBlocks", () => __awaiter(this, void 0, void 0, function* () {
                yield downloadBlocks(startHeight, latestBlockToDownload);
            }));
        }
        yield benchmark.measureAsync("insertBlocks", () => __awaiter(this, void 0, void 0, function* () {
            if (constants_1.executionMode === constants_1.ExecutionMode.RebuildAll) {
                yield dbConnection_1.sequelize.query("DROP INDEX message_height");
                if (env_1.env.ActiveChain === "akash") {
                    yield dbConnection_1.sequelize.query("DROP INDEX message_related_deployment_id");
                }
                yield dbConnection_1.sequelize.query("DROP INDEX message_tx_id");
                yield dbConnection_1.sequelize.query("DROP INDEX message_tx_id_is_processed");
            }
            const latestHeightInDb = (yield dbSchemas_1.Block.max("height")) || chainDefinitions_1.activeChain.startHeight || 0;
            yield insertBlocks(latestHeightInDb + 1, latestBlockToDownload);
            if (constants_1.executionMode === constants_1.ExecutionMode.RebuildAll) {
                yield benchmark.measureAsync("Add indexes", () => __awaiter(this, void 0, void 0, function* () {
                    yield dbSchemas_1.Message.sync();
                }));
            }
        }));
        benchmark.displayTimes();
        yield benchmark.measureAsync("processMessages", () => __awaiter(this, void 0, void 0, function* () {
            yield statsProcessor_1.statsProcessor.processMessages();
        }));
        benchmark.displayTimes();
        if (!env_1.env.KeepCache) {
            yield (0, dataStore_1.deleteCache)();
        }
    });
}
exports.syncBlocks = syncBlocks;
function insertBlocks(startHeight, endHeight) {
    return __awaiter(this, void 0, void 0, function* () {
        const blockCount = endHeight - startHeight + 1;
        console.log("Inserting " + blockCount + " blocks into database");
        let lastInsertedBlock = (yield dbSchemas_1.Block.findOne({
            include: [
                {
                    model: base_1.Day,
                    required: true
                }
            ],
            order: [["height", "DESC"]]
        }));
        let blocksToAdd = [];
        let txsToAdd = [];
        let msgsToAdd = [];
        for (let i = startHeight; i <= endHeight; ++i) {
            const getCachedBlockTimer = benchmark.startTimer("getCachedBlockByHeight");
            const blockData = yield (0, dataStore_1.getCachedBlockByHeight)(i);
            getCachedBlockTimer.end();
            if (!blockData) {
                missingBlock = i;
                throw "Block # " + i + " was not in cache";
            }
            let msgIndexInBlock = 0;
            const blockDatetime = new Date(blockData.block.header.time);
            const txs = blockData.block.data.txs;
            let blockResults = null;
            if (txs.length > 0) {
                blockResults = yield (0, dataStore_1.getCachedBlockResultsByHeight)(i);
                if (!blockResults)
                    throw "Block results # " + i + " was not in cache";
            }
            for (let txIndex = 0; txIndex < txs.length; ++txIndex) {
                const tx = txs[txIndex];
                const hash = (0, js_sha256_1.sha256)(Buffer.from(tx, "base64")).toUpperCase();
                const txId = uuid.v4();
                const decodedTx = (0, proto_signing_1.decodeTxRaw)((0, encoding_1.fromBase64)(tx));
                const msgs = decodedTx.body.messages;
                for (let msgIndex = 0; msgIndex < msgs.length; ++msgIndex) {
                    const msg = msgs[msgIndex];
                    msgsToAdd.push({
                        id: uuid.v4(),
                        txId: txId,
                        type: msg.typeUrl,
                        typeCategory: msg.typeUrl.split(".")[0].substring(1),
                        index: msgIndex,
                        height: i,
                        indexInBlock: msgIndexInBlock++,
                        data: Buffer.from(msg.value)
                    });
                }
                const txJson = blockResults.txs_results[txIndex];
                txsToAdd.push({
                    id: txId,
                    hash: hash,
                    height: i,
                    msgCount: msgs.length,
                    index: txIndex,
                    fee: decodedTx.authInfo.fee.amount.length > 0 ? parseInt(decodedTx.authInfo.fee.amount[0].amount) : 0,
                    memo: decodedTx.body.memo,
                    hasProcessingError: !!txJson.code,
                    log: !!txJson.code ? txJson.log : null,
                    gasUsed: parseInt(txJson.gas_used),
                    gasWanted: parseInt(txJson.gas_wanted)
                });
            }
            const blockEntry = {
                height: i,
                datetime: new Date(blockData.block.header.time),
                hash: blockData.block_id.hash,
                proposer: blockData.block.header.proposer_address,
                totalTxCount: ((lastInsertedBlock === null || lastInsertedBlock === void 0 ? void 0 : lastInsertedBlock.totalTxCount) || 0) + txs.length,
                dayId: lastInsertedBlock === null || lastInsertedBlock === void 0 ? void 0 : lastInsertedBlock.dayId,
                day: lastInsertedBlock === null || lastInsertedBlock === void 0 ? void 0 : lastInsertedBlock.day,
                txCount: txs.length
            };
            const blockDate = new Date(Date.UTC(blockDatetime.getUTCFullYear(), blockDatetime.getUTCMonth(), blockDatetime.getUTCDate()));
            if (!lastInsertedBlock || !(0, date_fns_1.isEqual)(blockDate, lastInsertedBlock.day.date)) {
                console.log("Creating day: ", blockDate, i);
                const [newDay, created] = yield base_1.Day.findOrCreate({
                    where: {
                        date: blockDate
                    },
                    defaults: {
                        id: uuid.v4(),
                        date: blockDate,
                        firstBlockHeight: i,
                        lastBlockHeightYet: i
                    }
                });
                if (!created) {
                    console.warn(`Day ${blockDate} already exists in database`);
                }
                blockEntry.dayId = newDay.id;
                blockEntry.day = newDay;
                if (lastInsertedBlock) {
                    lastInsertedBlock.day.lastBlockHeight = lastInsertedBlock.height;
                    lastInsertedBlock.day.lastBlockHeightYet = lastInsertedBlock.height;
                    yield lastInsertedBlock.day.save();
                }
            }
            lastInsertedBlock = blockEntry;
            blocksToAdd.push(blockEntry);
            if (blocksToAdd.length >= 500 || i === endHeight) {
                try {
                    yield dbConnection_1.sequelize.transaction((insertDbTransaction) => __awaiter(this, void 0, void 0, function* () {
                        yield benchmark.measureAsync("createBlocks", () => __awaiter(this, void 0, void 0, function* () {
                            yield dbSchemas_1.Block.bulkCreate(blocksToAdd, { transaction: insertDbTransaction });
                        }));
                        yield benchmark.measureAsync("createTransactions", () => __awaiter(this, void 0, void 0, function* () {
                            yield base_1.Transaction.bulkCreate(txsToAdd, { transaction: insertDbTransaction });
                        }));
                        yield benchmark.measureAsync("createmessages", () => __awaiter(this, void 0, void 0, function* () {
                            yield dbSchemas_1.Message.bulkCreate(msgsToAdd, { transaction: insertDbTransaction });
                        }));
                        blocksToAdd = [];
                        txsToAdd = [];
                        msgsToAdd = [];
                        console.log(`Blocks added to db: ${i - startHeight + 1} / ${blockCount} (${(((i - startHeight + 1) * 100) / blockCount).toFixed(2)}%)`);
                        if (lastInsertedBlock) {
                            lastInsertedBlock.day.lastBlockHeightYet = lastInsertedBlock.height;
                            yield lastInsertedBlock.day.save({ transaction: insertDbTransaction });
                        }
                    }));
                }
                catch (error) {
                    console.log(error, txsToAdd);
                }
            }
        }
    });
}
function downloadBlocks(startHeight, endHeight) {
    return __awaiter(this, void 0, void 0, function* () {
        const missingBlockCount = endHeight - startHeight + 1;
        let lastLogDate = Date.now();
        let downloadedCount = 0;
        const blockArr = Array.from(Array(missingBlockCount), (_, i) => i + startHeight);
        yield (0, async_1.eachLimit)(blockArr, 100, (0, async_1.asyncify)((height) => __awaiter(this, void 0, void 0, function* () {
            yield downloadBlock(height);
            downloadedCount++;
            if (Date.now() - lastLogDate > 500) {
                lastLogDate = Date.now();
                console.clear();
                console.log("Progress: " + ((downloadedCount * 100) / missingBlockCount).toFixed(2) + "%");
                if (!constants_1.isProd) {
                    nodeAccessor_1.nodeAccessor.displayTable();
                }
            }
        })));
    });
}
function downloadBlock(height) {
    return __awaiter(this, void 0, void 0, function* () {
        let wasInCache = true;
        let blockJson = yield (0, dataStore_1.getCachedBlockByHeight)(height);
        if (!blockJson) {
            wasInCache = false;
            const responseJson = yield nodeAccessor_1.nodeAccessor.getBlock(height);
            blockJson = responseJson.result;
        }
        if (blockJson.block.data.txs.length > 0) {
            const cachedBlockResult = yield (0, dataStore_1.getCachedBlockResultsByHeight)(height);
            if (!cachedBlockResult) {
                const blockResultJson = yield nodeAccessor_1.nodeAccessor.getBlockResult(height);
                yield dataStore_1.blockResultsDb.put((0, dataStore_1.blockHeightToKey)(height), JSON.stringify(blockResultJson.result));
            }
        }
        if (!wasInCache) {
            yield dataStore_1.blocksDb.put((0, dataStore_1.blockHeightToKey)(height), JSON.stringify(blockJson));
        }
    });
}
//# sourceMappingURL=chainSync.js.map