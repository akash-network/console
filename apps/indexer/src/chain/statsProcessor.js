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
exports.statsProcessor = void 0;
const js_sha256_1 = require("js-sha256");
const dataStore_1 = require("@src/chain/dataStore");
const base_1 = require("@akashnetwork/cloudmos-shared/dbSchemas/base");
const constants_1 = require("@src/shared/constants");
const protobuf_1 = require("@src/shared/utils/protobuf");
const indexers_1 = require("@src/indexers");
const benchmark = __importStar(require("@src/shared/utils/benchmark"));
const genesisImporter_1 = require("./genesisImporter");
const dbConnection_1 = require("@src/db/dbConnection");
const chainDefinitions_1 = require("@akashnetwork/cloudmos-shared/chainDefinitions");
const sequelize_1 = require("sequelize");
const dbSchemas_1 = require("@akashnetwork/cloudmos-shared/dbSchemas");
const chainSync_1 = require("./chainSync");
const proto_signing_1 = require("@cosmjs/proto-signing");
const encoding_1 = require("@cosmjs/encoding");
class StatsProcessor {
    constructor() {
        this.cacheInitialized = false;
    }
    rebuildStatsTables() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Setting "isProcessed" to false');
            yield dbSchemas_1.Message.update({
                isProcessed: false,
                relatedDeploymentId: null
            }, { where: { isProcessed: true } });
            yield base_1.Transaction.update({
                isProcessed: false
            }, { where: { isProcessed: true } });
            yield dbSchemas_1.Block.update({
                isProcessed: false
            }, { where: { isProcessed: true } });
            console.log("Rebuilding stats tables...");
            for (const indexer of indexers_1.activeIndexers) {
                yield indexer.recreateTables();
                if (!chainDefinitions_1.activeChain.startHeight) {
                    const genesis = yield (0, genesisImporter_1.getGenesis)();
                    yield indexer.seed(genesis);
                }
            }
            console.time("Processing messages");
            yield this.processMessages();
            console.timeEnd("Processing messages");
        });
    }
    processMessages() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("Querying unprocessed messages...");
            const shouldProcessEveryBlocks = indexers_1.activeIndexers.some((indexer) => indexer.runForEveryBlocks);
            const groupSize = 100;
            const previousBlockTimer = benchmark.startTimer("getPreviousProcessedBlock");
            let previousProcessedBlock = yield dbSchemas_1.Block.findOne({
                where: {
                    isProcessed: true
                },
                order: [["height", "DESC"]]
            });
            previousBlockTimer.end();
            const maxDbHeight = (yield dbSchemas_1.Block.max("height"));
            const hasNewBlocks = !previousProcessedBlock || maxDbHeight > previousProcessedBlock.height;
            if (!hasNewBlocks) {
                console.log("No new blocks to process");
                return;
            }
            const firstUnprocessedHeight = !previousProcessedBlock ? chainDefinitions_1.activeChain.startHeight || 1 : previousProcessedBlock.height + 1;
            if (!this.cacheInitialized) {
                for (const indexer of indexers_1.activeIndexers) {
                    yield indexer.initCache(firstUnprocessedHeight);
                }
                this.cacheInitialized = true;
            }
            let firstBlockToProcess = firstUnprocessedHeight;
            let lastBlockToProcess = Math.min(maxDbHeight, firstBlockToProcess + groupSize, constants_1.lastBlockToSync);
            while (firstBlockToProcess <= Math.min(maxDbHeight, constants_1.lastBlockToSync)) {
                console.log(`Loading blocks ${firstBlockToProcess} to ${lastBlockToProcess}`);
                const getBlocksTimer = benchmark.startTimer("getBlocks");
                const blocks = yield dbSchemas_1.Block.findAll({
                    attributes: ["height"],
                    where: {
                        isProcessed: false,
                        height: { [sequelize_1.Op.gte]: firstBlockToProcess, [sequelize_1.Op.lte]: lastBlockToProcess }
                    },
                    include: [
                        {
                            model: base_1.Transaction,
                            required: false,
                            where: {
                                isProcessed: false
                            },
                            include: [
                                {
                                    model: dbSchemas_1.Message,
                                    required: false,
                                    where: {
                                        isProcessed: false,
                                        type: { [sequelize_1.Op.in]: indexers_1.indexersMsgTypes }
                                    }
                                }
                            ]
                        }
                    ],
                    order: [
                        ["height", "ASC"],
                        ["transactions", "index", "ASC"],
                        ["transactions", "messages", "index", "ASC"]
                    ]
                });
                getBlocksTimer.end();
                const blockGroupTransaction = yield dbConnection_1.sequelize.transaction();
                try {
                    for (const block of blocks) {
                        const getBlockByHeightTimer = benchmark.startTimer("getBlockByHeight");
                        const blockData = yield (0, dataStore_1.getCachedBlockByHeight)(block.height);
                        getBlockByHeightTimer.end();
                        if (!blockData) {
                            (0, chainSync_1.setMissingBlock)(block.height);
                            throw new Error(`Block ${block.height} not found in cache`);
                        }
                        for (const transaction of block.transactions) {
                            const decodeTimer = benchmark.startTimer("decodeTx");
                            const tx = blockData.block.data.txs.find((t) => (0, js_sha256_1.sha256)(Buffer.from(t, "base64")).toUpperCase() === transaction.hash);
                            const decodedTx = (0, proto_signing_1.decodeTxRaw)((0, encoding_1.fromBase64)(tx));
                            decodeTimer.end();
                            for (const msg of transaction.messages) {
                                console.log(`Processing message ${msg.type} - Block #${block.height}`);
                                const encodedMessage = decodedTx.body.messages[msg.index].value;
                                yield benchmark.measureAsync("processMessage", () => __awaiter(this, void 0, void 0, function* () {
                                    yield this.processMessage(msg, encodedMessage, block.height, blockGroupTransaction, transaction.hasProcessingError);
                                }));
                                if (msg.relatedDeploymentId || msg.amount) {
                                    yield benchmark.measureAsync("saveRelatedDeploymentId", () => __awaiter(this, void 0, void 0, function* () {
                                        yield msg.save({ transaction: blockGroupTransaction });
                                    }));
                                }
                            }
                            for (const indexer of indexers_1.activeIndexers) {
                                yield indexer.afterEveryTransaction(decodedTx, transaction, blockGroupTransaction);
                            }
                            yield benchmark.measureAsync("saveTransaction", () => __awaiter(this, void 0, void 0, function* () {
                                yield transaction.save({ transaction: blockGroupTransaction });
                            }));
                        }
                        for (const indexer of indexers_1.activeIndexers) {
                            yield indexer.afterEveryBlock(block, previousProcessedBlock, blockGroupTransaction);
                        }
                        if (shouldProcessEveryBlocks) {
                            yield benchmark.measureAsync("blockUpdate", () => __awaiter(this, void 0, void 0, function* () {
                                block.isProcessed = true;
                                yield block.save({ transaction: blockGroupTransaction });
                            }));
                        }
                        previousProcessedBlock = block;
                    }
                    if (!shouldProcessEveryBlocks) {
                        yield benchmark.measureAsync("blockUpdateIsProcessed", () => __awaiter(this, void 0, void 0, function* () {
                            yield dbSchemas_1.Block.update({
                                isProcessed: true
                            }, {
                                where: {
                                    height: { [sequelize_1.Op.gte]: firstBlockToProcess, [sequelize_1.Op.lte]: lastBlockToProcess }
                                },
                                transaction: blockGroupTransaction
                            });
                        }));
                    }
                    yield benchmark.measureAsync("transactionUpdate", () => __awaiter(this, void 0, void 0, function* () {
                        yield base_1.Transaction.update({
                            isProcessed: true
                        }, {
                            where: {
                                height: { [sequelize_1.Op.gte]: firstBlockToProcess, [sequelize_1.Op.lte]: lastBlockToProcess }
                            },
                            transaction: blockGroupTransaction
                        });
                    }));
                    yield benchmark.measureAsync("MsgUpdate", () => __awaiter(this, void 0, void 0, function* () {
                        yield dbSchemas_1.Message.update({
                            isProcessed: true
                        }, {
                            where: {
                                height: { [sequelize_1.Op.gte]: firstBlockToProcess, [sequelize_1.Op.lte]: lastBlockToProcess }
                            },
                            transaction: blockGroupTransaction
                        });
                    }));
                    yield benchmark.measureAsync("blockGroupTransactionCommit", () => __awaiter(this, void 0, void 0, function* () {
                        yield blockGroupTransaction.commit();
                    }));
                }
                catch (err) {
                    yield blockGroupTransaction.rollback();
                    throw err;
                }
                firstBlockToProcess += groupSize;
                lastBlockToProcess = Math.min(maxDbHeight, firstBlockToProcess + groupSize, constants_1.lastBlockToSync);
            }
        });
    }
    processMessage(msg, encodedMessage, height, blockGroupTransaction, hasProcessingError) {
        return __awaiter(this, void 0, void 0, function* () {
            for (const indexer of indexers_1.activeIndexers) {
                if (indexer.hasHandlerForType(msg.type) && (!hasProcessingError || indexer.processFailedTxs)) {
                    const decodedMessage = (0, protobuf_1.decodeMsg)(msg.type, encodedMessage);
                    yield indexer.processMessage(decodedMessage, height, blockGroupTransaction, msg);
                }
            }
        });
    }
}
exports.statsProcessor = new StatsProcessor();
//# sourceMappingURL=statsProcessor.js.map