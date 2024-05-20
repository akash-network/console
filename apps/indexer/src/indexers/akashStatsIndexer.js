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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
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
exports.AkashStatsIndexer = void 0;
const benchmark = __importStar(require("../shared/utils/benchmark"));
const uuid = __importStar(require("uuid"));
const protobuf_1 = require("@src/shared/utils/protobuf");
const akashPaymentSettle_1 = require("@src/shared/utils/akashPaymentSettle");
const indexer_1 = require("./indexer");
const coin_1 = require("@src/shared/utils/coin");
const akash_1 = require("@akashnetwork/cloudmos-shared/dbSchemas/akash");
const akash_2 = require("@akashnetwork/cloudmos-shared/dbSchemas/akash");
const sequelize_1 = require("sequelize");
class ITotalResources {
}
const denomMapping = {
    uakt: "uakt",
    "ibc/12C6A0C374171B595A0A9E18B83FA09D295FB1F2D8C6DAA3AC28683471752D84": "uusdc",
    "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1": "uusdc" // USDC on Mainnet
};
class AkashStatsIndexer extends indexer_1.Indexer {
    addToDeploymentIdCache(owner, dseq, id) {
        this.deploymentIdCache[owner + "_" + dseq] = id;
    }
    getDeploymentIdFromCache(owner, dseq) {
        return this.deploymentIdCache[owner + "_" + dseq];
    }
    addToDeploymentGroupIdCache(owner, dseq, gseq, id) {
        this.deploymentGroupIdCache[owner + "_" + dseq + "_" + gseq] = id;
    }
    getDeploymentGroupIdFromCache(owner, dseq, gseq) {
        return this.deploymentGroupIdCache[owner + "_" + dseq + "_" + gseq];
    }
    constructor() {
        super();
        this.totalLeaseCount = 0;
        this.activeProviderCount = 0;
        this.deploymentIdCache = {};
        this.deploymentGroupIdCache = {};
        this.name = "AkashStatsIndexer";
        this.runForEveryBlocks = true;
        this.msgHandlers = {
            // Akash v1beta1 types
            "/akash.deployment.v1beta1.MsgCreateDeployment": this.handleCreateDeployment,
            "/akash.deployment.v1beta1.MsgCloseDeployment": this.handleCloseDeployment,
            "/akash.market.v1beta1.MsgCreateLease": this.handleCreateLease,
            "/akash.market.v1beta1.MsgCloseLease": this.handleCloseLease,
            "/akash.market.v1beta1.MsgCreateBid": this.handleCreateBid,
            "/akash.market.v1beta1.MsgCloseBid": this.handleCloseBid,
            "/akash.deployment.v1beta1.MsgDepositDeployment": this.handleDepositDeployment,
            "/akash.market.v1beta1.MsgWithdrawLease": this.handleWithdrawLease,
            "/akash.provider.v1beta1.MsgCreateProvider": this.handleCreateProvider,
            "/akash.provider.v1beta1.MsgUpdateProvider": this.handleUpdateProvider,
            "/akash.provider.v1beta1.MsgDeleteProvider": this.handleDeleteProvider,
            "/akash.audit.v1beta1.MsgSignProviderAttributes": this.handleSignProviderAttributes,
            "/akash.audit.v1beta1.MsgDeleteProviderAttributes": this.handleDeleteSignProviderAttributes,
            // Akash v1beta2 types
            "/akash.deployment.v1beta2.MsgCreateDeployment": this.handleCreateDeploymentV2,
            "/akash.deployment.v1beta2.MsgCloseDeployment": this.handleCloseDeployment,
            "/akash.market.v1beta2.MsgCreateLease": this.handleCreateLease,
            "/akash.market.v1beta2.MsgCloseLease": this.handleCloseLease,
            "/akash.market.v1beta2.MsgCreateBid": this.handleCreateBidV2,
            "/akash.market.v1beta2.MsgCloseBid": this.handleCloseBid,
            "/akash.deployment.v1beta2.MsgDepositDeployment": this.handleDepositDeployment,
            "/akash.market.v1beta2.MsgWithdrawLease": this.handleWithdrawLease,
            "/akash.provider.v1beta2.MsgCreateProvider": this.handleCreateProvider,
            "/akash.provider.v1beta2.MsgUpdateProvider": this.handleUpdateProvider,
            "/akash.provider.v1beta2.MsgDeleteProvider": this.handleDeleteProvider,
            "/akash.audit.v1beta2.MsgSignProviderAttributes": this.handleSignProviderAttributes,
            "/akash.audit.v1beta2.MsgDeleteProviderAttributes": this.handleDeleteSignProviderAttributes,
            // Akash v1beta3 types
            "/akash.deployment.v1beta3.MsgCreateDeployment": this.handleCreateDeploymentV3,
            "/akash.deployment.v1beta3.MsgCloseDeployment": this.handleCloseDeployment,
            "/akash.market.v1beta3.MsgCreateLease": this.handleCreateLease,
            "/akash.market.v1beta3.MsgCloseLease": this.handleCloseLease,
            "/akash.market.v1beta3.MsgCreateBid": this.handleCreateBidV3,
            "/akash.market.v1beta3.MsgCloseBid": this.handleCloseBid,
            "/akash.deployment.v1beta3.MsgDepositDeployment": this.handleDepositDeployment,
            "/akash.market.v1beta3.MsgWithdrawLease": this.handleWithdrawLease,
            "/akash.provider.v1beta3.MsgCreateProvider": this.handleCreateProvider,
            "/akash.provider.v1beta3.MsgUpdateProvider": this.handleUpdateProvider,
            "/akash.provider.v1beta3.MsgDeleteProvider": this.handleDeleteProvider,
            "/akash.audit.v1beta3.MsgSignProviderAttributes": this.handleSignProviderAttributes,
            "/akash.audit.v1beta3.MsgDeleteProviderAttributes": this.handleDeleteSignProviderAttributes,
            // Akash v1beta4 types
            "/akash.market.v1beta4.MsgCreateLease": this.handleCreateLease,
            "/akash.market.v1beta4.MsgCloseLease": this.handleCloseLease,
            "/akash.market.v1beta4.MsgCreateBid": this.handleCreateBidV4,
            "/akash.market.v1beta4.MsgCloseBid": this.handleCloseBid
        };
    }
    dropTables() {
        return __awaiter(this, void 0, void 0, function* () {
            yield akash_1.Bid.drop({ cascade: true });
            yield akash_1.Lease.drop({ cascade: true });
            yield akash_1.ProviderSnapshotNodeCPU.drop({ cascade: true });
            yield akash_1.ProviderSnapshotNodeGPU.drop({ cascade: true });
            yield akash_1.ProviderSnapshotNode.drop({ cascade: true });
            yield akash_1.ProviderSnapshot.drop({ cascade: true });
            yield akash_1.ProviderAttributeSignature.drop({ cascade: true });
            yield akash_1.ProviderAttribute.drop({ cascade: true });
            yield akash_1.Provider.drop({ cascade: true });
            yield akash_1.DeploymentGroupResource.drop({ cascade: true });
            yield akash_1.DeploymentGroup.drop({ cascade: true });
            yield akash_1.Deployment.drop({ cascade: true });
        });
    }
    createTables() {
        return __awaiter(this, void 0, void 0, function* () {
            yield akash_1.Deployment.sync({ force: false });
            yield akash_1.DeploymentGroup.sync({ force: false });
            yield akash_1.DeploymentGroupResource.sync({ force: false });
            yield akash_1.Provider.sync({ force: false });
            yield akash_1.ProviderAttribute.sync({ force: false });
            yield akash_1.ProviderAttributeSignature.sync({ force: false });
            yield akash_1.ProviderSnapshot.sync({ force: false });
            yield akash_1.ProviderSnapshotNode.sync({ force: false });
            yield akash_1.ProviderSnapshotNodeCPU.sync({ force: false });
            yield akash_1.ProviderSnapshotNodeGPU.sync({ force: false });
            yield akash_1.Lease.sync({ force: false });
            yield akash_1.Bid.sync({ force: false });
        });
    }
    initCache(firstBlockHeight) {
        return __awaiter(this, void 0, void 0, function* () {
            this.totalResources = yield this.getTotalResources(null, firstBlockHeight);
            this.predictedClosedHeights = yield this.getFuturePredictedCloseHeights(firstBlockHeight, null);
            console.log("Fetching deployment id cache...");
            const existingDeployments = yield akash_1.Deployment.findAll({
                attributes: ["id", "owner", "dseq"]
            });
            existingDeployments.forEach((d) => this.addToDeploymentIdCache(d.owner, d.dseq, d.id));
            const existingDeploymentGroups = yield akash_1.DeploymentGroup.findAll({
                attributes: ["id", "owner", "dseq", "gseq"]
            });
            existingDeploymentGroups.forEach((d) => this.addToDeploymentGroupIdCache(d.owner, d.dseq, d.gseq, d.id));
            this.totalLeaseCount = yield akash_1.Lease.count();
            this.activeProviderCount = yield akash_1.Provider.count();
        });
    }
    afterEveryBlock(currentBlock, previousBlock, dbTransaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const shouldRefreshPredictedHeights = currentBlock.transactions.some((tx) => tx.messages.some((msg) => this.checkShouldRefreshPredictedCloseHeight(msg)));
            if (shouldRefreshPredictedHeights) {
                this.predictedClosedHeights = yield this.getFuturePredictedCloseHeights(currentBlock.height, dbTransaction);
            }
            if (shouldRefreshPredictedHeights || this.predictedClosedHeights.includes(currentBlock.height)) {
                this.totalResources = yield this.getTotalResources(dbTransaction, currentBlock.height);
            }
            currentBlock.activeProviderCount = this.activeProviderCount;
            currentBlock.activeLeaseCount = this.totalResources.count;
            currentBlock.totalLeaseCount = this.totalLeaseCount;
            currentBlock.activeCPU = this.totalResources.cpuSum;
            currentBlock.activeGPU = this.totalResources.gpuSum;
            currentBlock.activeMemory = this.totalResources.memorySum;
            currentBlock.activeEphemeralStorage = this.totalResources.ephemeralStorageSum;
            currentBlock.activePersistentStorage = this.totalResources.persistentStorageSum;
            currentBlock.totalUAktSpent = ((previousBlock === null || previousBlock === void 0 ? void 0 : previousBlock.totalUAktSpent) || 0) + this.totalResources.priceSumUAKT;
            currentBlock.totalUUsdcSpent = ((previousBlock === null || previousBlock === void 0 ? void 0 : previousBlock.totalUUsdcSpent) || 0) + this.totalResources.priceSumUUSDC;
        });
    }
    getFuturePredictedCloseHeights(firstBlock, blockGroupTransaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const leases = yield akash_1.Lease.findAll({
                attributes: ["predictedClosedHeight"],
                where: {
                    predictedClosedHeight: { [sequelize_1.Op.gte]: firstBlock }
                },
                transaction: blockGroupTransaction
            });
            return leases.map((x) => x.predictedClosedHeight);
        });
    }
    getTotalResources(blockGroupTransaction, height) {
        return __awaiter(this, void 0, void 0, function* () {
            const totalResources = yield akash_1.Lease.findAll({
                attributes: ["cpuUnits", "gpuUnits", "memoryQuantity", "ephemeralStorageQuantity", "persistentStorageQuantity", "price", "denom"],
                where: {
                    closedHeight: { [sequelize_1.Op.is]: null },
                    predictedClosedHeight: { [sequelize_1.Op.gt]: height }
                },
                transaction: blockGroupTransaction
            });
            return {
                count: totalResources.length,
                cpuSum: totalResources.map((x) => x.cpuUnits).reduce((a, b) => a + b, 0),
                gpuSum: totalResources.map((x) => x.gpuUnits).reduce((a, b) => a + b, 0),
                memorySum: totalResources.map((x) => x.memoryQuantity).reduce((a, b) => a + b, 0),
                ephemeralStorageSum: totalResources.map((x) => x.ephemeralStorageQuantity).reduce((a, b) => a + b, 0),
                persistentStorageSum: totalResources.map((x) => x.persistentStorageQuantity).reduce((a, b) => a + b, 0),
                priceSumUAKT: totalResources
                    .filter((x) => x.denom === "uakt")
                    .map((x) => x.price)
                    .reduce((a, b) => a + b, 0),
                priceSumUUSDC: totalResources
                    .filter((x) => x.denom === "uusdc")
                    .map((x) => x.price)
                    .reduce((a, b) => a + b, 0)
            };
        });
    }
    checkShouldRefreshPredictedCloseHeight(msg) {
        return [
            // v1beta1
            "/akash.deployment.v1beta1.MsgCreateDeployment",
            "/akash.deployment.v1beta1.MsgCloseDeployment",
            "/akash.market.v1beta1.MsgCreateLease",
            "/akash.market.v1beta1.MsgCloseLease",
            "/akash.market.v1beta1.MsgCloseBid",
            "/akash.deployment.v1beta1.MsgDepositDeployment",
            "/akash.market.v1beta1.MsgWithdrawLease",
            // v1beta2
            "/akash.deployment.v1beta2.MsgCreateDeployment",
            "/akash.deployment.v1beta2.MsgCloseDeployment",
            "/akash.market.v1beta2.MsgCreateLease",
            "/akash.market.v1beta2.MsgCloseLease",
            "/akash.market.v1beta2.MsgCloseBid",
            "/akash.deployment.v1beta2.MsgDepositDeployment",
            "/akash.market.v1beta2.MsgWithdrawLease",
            // v1beta3
            "/akash.deployment.v1beta3.MsgCreateDeployment",
            "/akash.deployment.v1beta3.MsgCloseDeployment",
            "/akash.market.v1beta3.MsgCreateLease",
            "/akash.market.v1beta3.MsgCloseLease",
            "/akash.market.v1beta3.MsgCloseBid",
            "/akash.deployment.v1beta3.MsgDepositDeployment",
            "/akash.market.v1beta3.MsgWithdrawLease",
            // v1beta4
            "/akash.market.v1beta4.MsgCreateLease",
            "/akash.market.v1beta4.MsgCloseLease",
            "/akash.market.v1beta4.MsgCloseBid",
            "/akash.market.v1beta4.MsgWithdrawLease"
        ].includes(msg.type);
    }
    handleCreateDeployment(decodedMessage, height, blockGroupTransaction, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const created = yield akash_1.Deployment.create({
                id: uuid.v4(),
                owner: decodedMessage.id.owner,
                dseq: decodedMessage.id.dseq.toString(),
                deposit: parseInt(decodedMessage.deposit.amount),
                balance: parseInt(decodedMessage.deposit.amount),
                withdrawnAmount: 0,
                denom: "uakt",
                createdHeight: height,
                closedHeight: null
            }, { transaction: blockGroupTransaction });
            msg.relatedDeploymentId = created.id;
            this.addToDeploymentIdCache(decodedMessage.id.owner, decodedMessage.id.dseq.toString(), created.id);
            for (const group of decodedMessage.groups) {
                const createdGroup = yield akash_1.DeploymentGroup.create({
                    id: uuid.v4(),
                    deploymentId: created.id,
                    owner: created.owner,
                    dseq: created.dseq,
                    gseq: decodedMessage.groups.indexOf(group) + 1
                }, { transaction: blockGroupTransaction });
                this.addToDeploymentGroupIdCache(createdGroup.owner, createdGroup.dseq, createdGroup.gseq, createdGroup.id);
                for (const groupResource of group.resources) {
                    yield akash_1.DeploymentGroupResource.create({
                        deploymentGroupId: createdGroup.id,
                        cpuUnits: parseInt((0, protobuf_1.uint8arrayToString)(groupResource.resources.cpu.units.val)),
                        gpuUnits: 0,
                        memoryQuantity: parseInt((0, protobuf_1.uint8arrayToString)(groupResource.resources.memory.quantity.val)),
                        ephemeralStorageQuantity: parseInt((0, protobuf_1.uint8arrayToString)(groupResource.resources.storage.quantity.val)),
                        persistentStorageQuantity: 0,
                        count: groupResource.count,
                        price: parseFloat(groupResource.price.amount) // TODO: handle denom
                    }, { transaction: blockGroupTransaction });
                }
            }
        });
    }
    handleCreateDeploymentV2(decodedMessage, height, blockGroupTransaction, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const created = yield akash_1.Deployment.create({
                id: uuid.v4(),
                owner: decodedMessage.id.owner,
                dseq: decodedMessage.id.dseq.toString(),
                deposit: parseInt(decodedMessage.deposit.amount),
                balance: parseInt(decodedMessage.deposit.amount),
                withdrawnAmount: 0,
                denom: "uakt",
                createdHeight: height,
                closedHeight: null
            }, { transaction: blockGroupTransaction });
            msg.relatedDeploymentId = created.id;
            this.addToDeploymentIdCache(decodedMessage.id.owner, decodedMessage.id.dseq.toString(), created.id);
            for (const group of decodedMessage.groups) {
                const createdGroup = yield akash_1.DeploymentGroup.create({
                    id: uuid.v4(),
                    deploymentId: created.id,
                    owner: created.owner,
                    dseq: created.dseq,
                    gseq: decodedMessage.groups.indexOf(group) + 1
                }, { transaction: blockGroupTransaction });
                this.addToDeploymentGroupIdCache(createdGroup.owner, createdGroup.dseq, createdGroup.gseq, createdGroup.id);
                for (const groupResource of group.resources) {
                    yield akash_1.DeploymentGroupResource.create({
                        deploymentGroupId: createdGroup.id,
                        cpuUnits: parseInt((0, protobuf_1.uint8arrayToString)(groupResource.resources.cpu.units.val)),
                        gpuUnits: 0,
                        memoryQuantity: parseInt((0, protobuf_1.uint8arrayToString)(groupResource.resources.memory.quantity.val)),
                        ephemeralStorageQuantity: groupResource.resources.storage
                            .filter((x) => !isPersistentStorage(x))
                            .map((x) => parseInt((0, protobuf_1.uint8arrayToString)(x.quantity.val)))
                            .reduce((a, b) => a + b, 0),
                        persistentStorageQuantity: groupResource.resources.storage
                            .filter((x) => isPersistentStorage(x))
                            .map((x) => parseInt((0, protobuf_1.uint8arrayToString)(x.quantity.val)))
                            .reduce((a, b) => a + b, 0),
                        count: groupResource.count,
                        price: parseFloat(groupResource.price.amount) // TODO: handle denom
                    }, { transaction: blockGroupTransaction });
                }
            }
        });
    }
    handleCreateDeploymentV3(decodedMessage, height, blockGroupTransaction, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(decodedMessage.deposit.denom in denomMapping)) {
                throw "Unknown denom: " + decodedMessage.deposit.denom;
            }
            const created = yield akash_1.Deployment.create({
                id: uuid.v4(),
                owner: decodedMessage.id.owner,
                dseq: decodedMessage.id.dseq.toString(),
                deposit: parseInt(decodedMessage.deposit.amount),
                balance: parseInt(decodedMessage.deposit.amount),
                withdrawnAmount: 0,
                denom: denomMapping[decodedMessage.deposit.denom],
                createdHeight: height,
                closedHeight: null
            }, { transaction: blockGroupTransaction });
            msg.relatedDeploymentId = created.id;
            this.addToDeploymentIdCache(decodedMessage.id.owner, decodedMessage.id.dseq.toString(), created.id);
            for (const group of decodedMessage.groups) {
                const createdGroup = yield akash_1.DeploymentGroup.create({
                    id: uuid.v4(),
                    deploymentId: created.id,
                    owner: created.owner,
                    dseq: created.dseq,
                    gseq: decodedMessage.groups.indexOf(group) + 1
                }, { transaction: blockGroupTransaction });
                this.addToDeploymentGroupIdCache(createdGroup.owner, createdGroup.dseq, createdGroup.gseq, createdGroup.id);
                for (const groupResource of group.resources) {
                    const { vendor: gpuVendor, model: gpuModel } = getGPUAttributes(groupResource.resource.gpu);
                    yield akash_1.DeploymentGroupResource.create({
                        deploymentGroupId: createdGroup.id,
                        cpuUnits: parseInt((0, protobuf_1.uint8arrayToString)(groupResource.resource.cpu.units.val)),
                        gpuUnits: parseInt((0, protobuf_1.uint8arrayToString)(groupResource.resource.gpu.units.val)),
                        gpuVendor: gpuVendor,
                        gpuModel: gpuModel,
                        memoryQuantity: parseInt((0, protobuf_1.uint8arrayToString)(groupResource.resource.memory.quantity.val)),
                        ephemeralStorageQuantity: groupResource.resource.storage
                            .filter((x) => !isPersistentStorage(x))
                            .map((x) => parseInt((0, protobuf_1.uint8arrayToString)(x.quantity.val)))
                            .reduce((a, b) => a + b, 0),
                        persistentStorageQuantity: groupResource.resource.storage
                            .filter((x) => isPersistentStorage(x))
                            .map((x) => parseInt((0, protobuf_1.uint8arrayToString)(x.quantity.val)))
                            .reduce((a, b) => a + b, 0),
                        count: groupResource.count,
                        price: parseFloat(groupResource.price.amount) // TODO: handle denom
                    }, { transaction: blockGroupTransaction });
                }
            }
        });
    }
    handleCloseDeployment(decodedMessage, height, blockGroupTransaction, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const deploymentId = this.getDeploymentIdFromCache(decodedMessage.id.owner, decodedMessage.id.dseq.toString());
            if (!deploymentId) {
                throw new Error(`Deployment ID for ${decodedMessage.id.owner}/${decodedMessage.id.dseq.toString()} not found in cache.`);
            }
            const deployment = yield akash_1.Deployment.findOne({
                where: {
                    id: deploymentId
                },
                include: [{ model: akash_1.Lease }],
                transaction: blockGroupTransaction
            });
            msg.relatedDeploymentId = deployment.id;
            yield (0, akashPaymentSettle_1.accountSettle)(deployment, height, blockGroupTransaction);
            for (const lease of deployment.leases.filter((x) => !x.closedHeight)) {
                lease.closedHeight = height;
                yield lease.save({ transaction: blockGroupTransaction });
            }
            deployment.closedHeight = height;
            yield deployment.save({ transaction: blockGroupTransaction });
        });
    }
    handleCreateLease(decodedMessage, height, blockGroupTransaction, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const bid = yield akash_1.Bid.findOne({
                where: {
                    owner: decodedMessage.bidId.owner,
                    dseq: decodedMessage.bidId.dseq.toString(),
                    gseq: decodedMessage.bidId.gseq,
                    oseq: decodedMessage.bidId.oseq,
                    provider: decodedMessage.bidId.provider
                },
                transaction: blockGroupTransaction
            });
            const deploymentGroupId = this.getDeploymentGroupIdFromCache(decodedMessage.bidId.owner, decodedMessage.bidId.dseq.toString(), decodedMessage.bidId.gseq);
            if (!deploymentGroupId) {
                throw new Error(`Deployment group ID for ${decodedMessage.bidId.owner}/${decodedMessage.bidId.dseq.toString()}/${decodedMessage.bidId.gseq} not found in cache.`);
            }
            const deploymentGroups = yield akash_1.DeploymentGroupResource.findAll({
                attributes: ["count", "cpuUnits", "gpuUnits", "memoryQuantity", "ephemeralStorageQuantity", "persistentStorageQuantity"],
                where: {
                    deploymentGroupId: deploymentGroupId
                },
                transaction: blockGroupTransaction
            });
            const deploymentId = this.getDeploymentIdFromCache(decodedMessage.bidId.owner, decodedMessage.bidId.dseq.toString());
            if (!deploymentId) {
                throw new Error(`Deployment ID for ${decodedMessage.bidId.owner}/${decodedMessage.bidId.dseq.toString()} not found in cache.`);
            }
            const deployment = yield akash_1.Deployment.findOne({
                where: {
                    id: deploymentId
                },
                include: [{ model: akash_1.Lease }],
                transaction: blockGroupTransaction
            });
            const { blockRate } = yield (0, akashPaymentSettle_1.accountSettle)(deployment, height, blockGroupTransaction);
            const predictedClosedHeight = Math.ceil(height + deployment.balance / (blockRate + bid.price));
            yield akash_1.Lease.create({
                id: uuid.v4(),
                deploymentId: deploymentId,
                deploymentGroupId: deploymentGroupId,
                owner: decodedMessage.bidId.owner,
                dseq: decodedMessage.bidId.dseq.toString(),
                oseq: decodedMessage.bidId.oseq,
                gseq: decodedMessage.bidId.gseq,
                providerAddress: decodedMessage.bidId.provider,
                createdHeight: height,
                predictedClosedHeight: predictedClosedHeight,
                price: bid.price,
                denom: deployment.denom,
                // Stats
                cpuUnits: deploymentGroups.map((x) => x.cpuUnits * x.count).reduce((a, b) => a + b, 0),
                gpuUnits: deploymentGroups.map((x) => x.gpuUnits * x.count).reduce((a, b) => a + b, 0),
                memoryQuantity: deploymentGroups.map((x) => x.memoryQuantity * x.count).reduce((a, b) => a + b, 0),
                ephemeralStorageQuantity: deploymentGroups.map((x) => x.ephemeralStorageQuantity * x.count).reduce((a, b) => a + b, 0),
                persistentStorageQuantity: deploymentGroups.map((x) => x.persistentStorageQuantity * x.count).reduce((a, b) => a + b, 0)
            }, { transaction: blockGroupTransaction });
            yield akash_1.Lease.update({ predictedClosedHeight: predictedClosedHeight }, { where: { deploymentId: deploymentId }, transaction: blockGroupTransaction });
            msg.relatedDeploymentId = deploymentId;
            this.totalLeaseCount++;
        });
    }
    handleCloseLease(decodedMessage, height, blockGroupTransaction, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const deploymentId = this.getDeploymentIdFromCache(decodedMessage.leaseId.owner, decodedMessage.leaseId.dseq.toString());
            if (!deploymentId) {
                throw new Error(`Deployment ID for ${decodedMessage.leaseId.owner}/${decodedMessage.leaseId.dseq.toString()} not found in cache.`);
            }
            const deployment = yield akash_1.Deployment.findOne({
                where: {
                    id: deploymentId
                },
                include: [{ model: akash_1.Lease }],
                transaction: blockGroupTransaction
            });
            const lease = deployment.leases.find((x) => x.oseq === decodedMessage.leaseId.oseq && x.gseq === decodedMessage.leaseId.gseq && x.providerAddress === decodedMessage.leaseId.provider);
            if (!lease)
                throw new Error("Lease not found");
            msg.relatedDeploymentId = deployment.id;
            const { blockRate } = yield (0, akashPaymentSettle_1.accountSettle)(deployment, height, blockGroupTransaction);
            lease.closedHeight = height;
            yield lease.save({ transaction: blockGroupTransaction });
            if (!deployment.leases.some((x) => !x.closedHeight)) {
                deployment.closedHeight = height;
                yield deployment.save({ transaction: blockGroupTransaction });
            }
            else {
                const predictedClosedHeight = Math.ceil((deployment.lastWithdrawHeight || lease.createdHeight) + deployment.balance / (blockRate - lease.price));
                yield akash_1.Lease.update({ predictedClosedHeight: predictedClosedHeight }, { where: { deploymentId: deployment.id }, transaction: blockGroupTransaction });
            }
        });
    }
    handleCreateBid(decodedMessage, height, blockGroupTransaction, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            yield akash_1.Bid.create({
                owner: decodedMessage.order.owner,
                dseq: decodedMessage.order.dseq.toString(),
                gseq: decodedMessage.order.gseq,
                oseq: decodedMessage.order.oseq,
                provider: decodedMessage.provider,
                price: parseInt(decodedMessage.price.amount),
                createdHeight: height
            }, { transaction: blockGroupTransaction });
            msg.relatedDeploymentId = this.getDeploymentIdFromCache(decodedMessage.order.owner, decodedMessage.order.dseq.toString());
        });
    }
    handleCreateBidV2(decodedMessage, height, blockGroupTransaction, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            yield akash_1.Bid.create({
                owner: decodedMessage.order.owner,
                dseq: decodedMessage.order.dseq.toString(),
                gseq: decodedMessage.order.gseq,
                oseq: decodedMessage.order.oseq,
                provider: decodedMessage.provider,
                price: parseFloat(decodedMessage.price.amount),
                createdHeight: height
            }, { transaction: blockGroupTransaction });
            msg.relatedDeploymentId = this.getDeploymentIdFromCache(decodedMessage.order.owner, decodedMessage.order.dseq.toString());
        });
    }
    handleCreateBidV3(decodedMessage, height, blockGroupTransaction, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            yield akash_1.Bid.create({
                owner: decodedMessage.order.owner,
                dseq: decodedMessage.order.dseq.toString(),
                gseq: decodedMessage.order.gseq,
                oseq: decodedMessage.order.oseq,
                provider: decodedMessage.provider,
                price: parseFloat(decodedMessage.price.amount),
                createdHeight: height
            }, { transaction: blockGroupTransaction });
            msg.relatedDeploymentId = this.getDeploymentIdFromCache(decodedMessage.order.owner, decodedMessage.order.dseq.toString());
        });
    }
    handleCreateBidV4(decodedMessage, height, blockGroupTransaction, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            yield akash_1.Bid.create({
                owner: decodedMessage.order.owner,
                dseq: decodedMessage.order.dseq.toString(),
                gseq: decodedMessage.order.gseq,
                oseq: decodedMessage.order.oseq,
                provider: decodedMessage.provider,
                price: parseFloat(decodedMessage.price.amount),
                createdHeight: height
            }, { transaction: blockGroupTransaction });
            msg.relatedDeploymentId = this.getDeploymentIdFromCache(decodedMessage.order.owner, decodedMessage.order.dseq.toString());
        });
    }
    handleCloseBid(decodedMessage, height, blockGroupTransaction, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const deploymentId = this.getDeploymentIdFromCache(decodedMessage.bidId.owner, decodedMessage.bidId.dseq.toString());
            if (!deploymentId) {
                throw new Error(`Deployment ID for ${decodedMessage.bidId.owner}/${decodedMessage.bidId.dseq.toString()} not found in cache.`);
            }
            const deployment = yield akash_1.Deployment.findOne({
                where: {
                    id: deploymentId
                },
                include: [{ model: akash_1.Lease }],
                transaction: blockGroupTransaction
            });
            msg.relatedDeploymentId = deployment.id;
            const lease = deployment.leases.find((x) => x.oseq === decodedMessage.bidId.oseq && x.gseq === decodedMessage.bidId.gseq && x.providerAddress === decodedMessage.bidId.provider);
            if (lease) {
                const { blockRate } = yield (0, akashPaymentSettle_1.accountSettle)(deployment, height, blockGroupTransaction);
                lease.closedHeight = height;
                yield lease.save({ transaction: blockGroupTransaction });
                if (!deployment.leases.some((x) => !x.closedHeight)) {
                    deployment.closedHeight = height;
                    yield deployment.save({ transaction: blockGroupTransaction });
                }
                else {
                    const predictedClosedHeight = Math.ceil((deployment.lastWithdrawHeight || lease.createdHeight) + deployment.balance / (blockRate - lease.price));
                    yield akash_1.Lease.update({ predictedClosedHeight: predictedClosedHeight }, { where: { deploymentId: deployment.id }, transaction: blockGroupTransaction });
                }
            }
            yield akash_1.Bid.destroy({
                where: {
                    owner: decodedMessage.bidId.owner,
                    dseq: decodedMessage.bidId.dseq.toString(),
                    gseq: decodedMessage.bidId.gseq,
                    oseq: decodedMessage.bidId.oseq,
                    provider: decodedMessage.bidId.provider
                },
                transaction: blockGroupTransaction
            });
        });
    }
    handleDepositDeployment(decodedMessage, height, blockGroupTransaction, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const deploymentId = this.getDeploymentIdFromCache(decodedMessage.id.owner, decodedMessage.id.dseq.toString());
            if (!deploymentId) {
                throw new Error(`Deployment ID for ${decodedMessage.id.owner}/${decodedMessage.id.dseq.toString()} not found in cache.`);
            }
            const deployment = yield akash_1.Deployment.findOne({
                where: {
                    id: deploymentId
                },
                include: [
                    {
                        model: akash_1.Lease
                    }
                ],
                transaction: blockGroupTransaction
            });
            msg.relatedDeploymentId = deployment.id;
            deployment.deposit += parseFloat(decodedMessage.amount.amount);
            deployment.balance += parseFloat(decodedMessage.amount.amount);
            yield deployment.save({ transaction: blockGroupTransaction });
            const blockRate = deployment.leases
                .filter((x) => !x.closedHeight)
                .map((x) => x.price)
                .reduce((a, b) => a + b, 0);
            for (const lease of deployment.leases.filter((x) => !x.closedHeight)) {
                lease.predictedClosedHeight = Math.ceil((deployment.lastWithdrawHeight || lease.createdHeight) + deployment.balance / blockRate);
                yield lease.save({ transaction: blockGroupTransaction });
            }
            msg.amount = (0, coin_1.getAmountFromCoin)(decodedMessage.amount);
        });
    }
    handleWithdrawLease(decodedMessage, height, blockGroupTransaction, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const owner = decodedMessage.bidId.owner;
            const dseq = decodedMessage.bidId.dseq.toString();
            const gseq = decodedMessage.bidId.gseq;
            const oseq = decodedMessage.bidId.oseq;
            const provider = decodedMessage.bidId.provider;
            const deployment = yield akash_1.Deployment.findOne({
                where: {
                    owner: owner,
                    dseq: dseq
                },
                include: [{ model: akash_1.Lease }],
                transaction: blockGroupTransaction
            });
            if (!deployment)
                throw new Error(`Deployment not found for owner: ${owner} and dseq: ${dseq}`);
            const lease = deployment.leases.find((x) => x.gseq === gseq && x.oseq === oseq && x.providerAddress === provider);
            if (!lease)
                throw new Error(`Lease not found for gseq: ${gseq}, oseq: ${oseq} and provider: ${provider}`);
            yield (0, akashPaymentSettle_1.accountSettle)(deployment, height, blockGroupTransaction);
            msg.relatedDeploymentId = deployment.id;
        });
    }
    handleCreateProvider(decodedMessage, height, blockGroupTransaction, msg) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            yield akash_1.Provider.create({
                owner: decodedMessage.owner,
                hostUri: decodedMessage.hostUri,
                createdHeight: height,
                email: (_a = decodedMessage.info) === null || _a === void 0 ? void 0 : _a.email,
                website: (_b = decodedMessage.info) === null || _b === void 0 ? void 0 : _b.website
            }, { transaction: blockGroupTransaction });
            yield akash_1.ProviderAttribute.bulkCreate(decodedMessage.attributes.map((attribute) => ({
                provider: decodedMessage.owner,
                key: attribute.key,
                value: attribute.value
            })), { transaction: blockGroupTransaction });
            this.activeProviderCount++;
        });
    }
    handleUpdateProvider(decodedMessage, height, blockGroupTransaction, msg) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            yield akash_1.Provider.update({
                hostUri: decodedMessage.hostUri,
                updatedHeight: height,
                email: (_a = decodedMessage.info) === null || _a === void 0 ? void 0 : _a.email,
                website: (_b = decodedMessage.info) === null || _b === void 0 ? void 0 : _b.website
            }, {
                where: {
                    owner: decodedMessage.owner
                },
                transaction: blockGroupTransaction
            });
            yield akash_1.ProviderAttribute.destroy({
                where: {
                    provider: decodedMessage.owner
                },
                transaction: blockGroupTransaction
            });
            yield akash_1.ProviderAttribute.bulkCreate(decodedMessage.attributes.map((attribute) => ({
                provider: decodedMessage.owner,
                key: attribute.key,
                value: attribute.value
            })), { transaction: blockGroupTransaction });
        });
    }
    handleDeleteProvider(decodedMessage, height, blockGroupTransaction, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            yield akash_1.Provider.update({
                deletedHeight: height
            }, {
                where: { owner: decodedMessage.owner },
                transaction: blockGroupTransaction
            });
            this.activeProviderCount--;
        });
    }
    handleSignProviderAttributes(decodedMessage, height, blockGroupTransaction, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const provider = yield akash_1.Provider.findOne({ where: { owner: decodedMessage.owner }, transaction: blockGroupTransaction });
            if (!provider) {
                console.warn(`Provider ${decodedMessage.owner} not found`);
                return;
            }
            for (const attribute of decodedMessage.attributes) {
                const existingAttributeSignature = yield akash_1.ProviderAttributeSignature.findOne({
                    where: {
                        provider: decodedMessage.owner,
                        auditor: decodedMessage.auditor,
                        key: attribute.key
                    },
                    transaction: blockGroupTransaction
                });
                if (existingAttributeSignature) {
                    yield existingAttributeSignature.update({
                        value: attribute.value
                    }, { transaction: blockGroupTransaction });
                }
                else {
                    yield akash_1.ProviderAttributeSignature.create({
                        provider: decodedMessage.owner,
                        auditor: decodedMessage.auditor,
                        key: attribute.key,
                        value: attribute.value
                    }, { transaction: blockGroupTransaction });
                }
            }
        });
    }
    handleDeleteSignProviderAttributes(decodedMessage, height, blockGroupTransaction, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            yield akash_1.ProviderAttributeSignature.destroy({
                where: {
                    provider: decodedMessage.owner,
                    auditor: decodedMessage.auditor,
                    key: { [sequelize_1.Op.in]: decodedMessage.keys }
                },
                transaction: blockGroupTransaction
            });
        });
    }
}
__decorate([
    benchmark.measureMethodAsync,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AkashStatsIndexer.prototype, "dropTables", null);
__decorate([
    benchmark.measureMethodAsync,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [akash_2.AkashBlock, akash_2.AkashBlock, sequelize_1.Transaction]),
    __metadata("design:returntype", Promise)
], AkashStatsIndexer.prototype, "afterEveryBlock", null);
__decorate([
    benchmark.measureMethodAsync,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, sequelize_1.Transaction]),
    __metadata("design:returntype", Promise)
], AkashStatsIndexer.prototype, "getFuturePredictedCloseHeights", null);
__decorate([
    benchmark.measureMethodAsync,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [sequelize_1.Transaction, Number]),
    __metadata("design:returntype", Promise)
], AkashStatsIndexer.prototype, "getTotalResources", null);
exports.AkashStatsIndexer = AkashStatsIndexer;
function isPersistentStorage(storage) {
    return (storage.attributes || []).some((a) => a.key === "persistent" && a.value === "true");
}
function getGPUAttributes(gpu) {
    if (!gpu.attributes || gpu.attributes.length !== 1)
        return { vendor: null, model: null };
    const attr = gpu.attributes[0];
    if (attr.value !== "true")
        return { vendor: null, model: null };
    const regex = /^vendor\/(.*)\/model\/(.*)$/;
    const match = attr.key.match(regex);
    if (!match)
        return { vendor: null, model: null };
    const vendor = match[1]; // "nvidia"
    const model = match[2] != "*" ? match[2] : null; // "a10"
    return { vendor, model };
}
//# sourceMappingURL=akashStatsIndexer.js.map