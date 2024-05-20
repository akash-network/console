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
exports.syncProvidersInfo = void 0;
const https_1 = __importDefault(require("https"));
const axios_1 = __importDefault(require("axios"));
const semver_1 = __importDefault(require("semver"));
const akash_1 = require("@akashnetwork/cloudmos-shared/dbSchemas/akash");
const async_1 = require("async");
const dbConnection_1 = require("@src/db/dbConnection");
const date_1 = require("@src/shared/utils/date");
const date_fns_1 = require("date-fns");
const grpc_1 = require("./statusEndpointHandlers/grpc");
const rest_1 = require("./statusEndpointHandlers/rest");
const sequelize_1 = require("sequelize");
const ConcurrentStatusCall = 10;
const StatusCallTimeout = 10000; // 10 seconds
const UptimeCheckIntervalSeconds = 15 * 60; // 15 minutes
function syncProvidersInfo() {
    return __awaiter(this, void 0, void 0, function* () {
        let providers = yield akash_1.Provider.findAll({
            where: {
                deletedHeight: null,
                nextCheckDate: { [sequelize_1.Op.lte]: (0, date_1.toUTC)(new Date()) }
            },
            include: [
                { model: akash_1.ProviderSnapshot, as: "lastSnapshot" },
                { model: akash_1.ProviderSnapshot, as: "downtimeFirstSnapshot" }
            ],
            order: [["nextCheckDate", "ASC"]]
        });
        const httpsAgent = new https_1.default.Agent({
            rejectUnauthorized: false
        });
        let doneCount = 0;
        yield (0, async_1.eachLimit)(providers, ConcurrentStatusCall, (0, async_1.asyncify)((provider) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            let providerStatus = null;
            let errorMessage = null;
            let akashVersion = null;
            let cosmosVersion = null;
            try {
                const versionResponse = yield axios_1.default.get(provider.hostUri + "/version", {
                    httpsAgent: httpsAgent,
                    timeout: StatusCallTimeout
                });
                akashVersion = semver_1.default.valid(versionResponse.data.akash.version);
                cosmosVersion = semver_1.default.valid("cosmosSdkVersion" in versionResponse.data.akash ? versionResponse.data.akash.cosmosSdkVersion : versionResponse.data.akash.cosmos_sdk_version);
                if (akashVersion && semver_1.default.gte(akashVersion, "0.5.0-0")) {
                    providerStatus = yield (0, grpc_1.fetchProviderStatusFromGRPC)(provider, StatusCallTimeout);
                }
                else {
                    providerStatus = yield (0, rest_1.fetchProviderStatusFromREST)(provider, StatusCallTimeout);
                }
            }
            catch (err) {
                errorMessage = (_b = (_a = err === null || err === void 0 ? void 0 : err.message) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : err === null || err === void 0 ? void 0 : err.toString();
            }
            yield saveProviderStatus(provider, providerStatus, akashVersion, cosmosVersion, errorMessage);
            doneCount++;
            console.log("Fetched provider info: " + doneCount + " / " + providers.length);
        })));
    });
}
exports.syncProvidersInfo = syncProvidersInfo;
function saveProviderStatus(provider, providerStatus, akashVersion, cosmosVersion, error) {
    return __awaiter(this, void 0, void 0, function* () {
        yield dbConnection_1.sequelize.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const checkDate = (0, date_1.toUTC)(new Date());
            const createdSnapshot = yield akash_1.ProviderSnapshot.create({
                owner: provider.owner,
                isOnline: !!providerStatus,
                isLastOfDay: true,
                isLastSuccessOfDay: !!providerStatus,
                error: error,
                checkDate: checkDate,
                deploymentCount: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.deploymentCount,
                leaseCount: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.leaseCount,
                activeCPU: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.activeCPU,
                activeGPU: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.activeGPU,
                activeMemory: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.activeMemory,
                activeStorage: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.activeStorage,
                pendingCPU: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.pendingCPU,
                pendingGPU: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.pendingGPU,
                pendingMemory: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.pendingMemory,
                pendingStorage: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.pendingStorage,
                availableCPU: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.availableCPU,
                availableGPU: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.availableGPU,
                availableMemory: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.availableMemory,
                availableStorage: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.availableStorage
            }, { transaction: t });
            if (provider.lastSnapshot && (0, date_fns_1.isSameDay)(provider.lastSnapshot.checkDate, checkDate)) {
                yield akash_1.ProviderSnapshot.update({
                    isLastOfDay: false,
                    isLastSuccessOfDay: false
                }, {
                    where: { id: provider.lastSnapshot.id },
                    transaction: t
                });
                if (providerStatus && provider.lastSuccessfulSnapshotId && provider.lastSuccessfulSnapshotId !== provider.lastSnapshotId) {
                    yield akash_1.ProviderSnapshot.update({
                        isLastSuccessOfDay: false
                    }, {
                        where: { id: provider.lastSuccessfulSnapshotId },
                        transaction: t
                    });
                }
            }
            yield akash_1.Provider.update({
                lastSnapshotId: createdSnapshot.id,
                lastSuccessfulSnapshotId: createdSnapshot.isOnline ? createdSnapshot.id : provider.lastSuccessfulSnapshotId,
                downtimeFirstSnapshotId: createdSnapshot.isOnline ? null : (_a = provider.downtimeFirstSnapshotId) !== null && _a !== void 0 ? _a : createdSnapshot.id,
                isOnline: !!providerStatus,
                error: error,
                lastCheckDate: checkDate,
                failedCheckCount: providerStatus ? 0 : provider.failedCheckCount + 1,
                nextCheckDate: getNextCheckDate(!!providerStatus, checkDate, (_c = (_b = provider.downtimeFirstSnapshot) === null || _b === void 0 ? void 0 : _b.checkDate) !== null && _c !== void 0 ? _c : createdSnapshot.checkDate),
                cosmosSdkVersion: cosmosVersion,
                akashVersion: akashVersion,
                deploymentCount: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.deploymentCount,
                leaseCount: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.leaseCount,
                activeCPU: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.activeCPU,
                activeGPU: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.activeGPU,
                activeMemory: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.activeMemory,
                activeStorage: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.activeStorage,
                pendingCPU: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.pendingCPU,
                pendingGPU: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.pendingGPU,
                pendingMemory: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.pendingMemory,
                pendingStorage: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.pendingStorage,
                availableCPU: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.availableCPU,
                availableGPU: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.availableGPU,
                availableMemory: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.availableMemory,
                availableStorage: providerStatus === null || providerStatus === void 0 ? void 0 : providerStatus.resources.availableStorage
            }, {
                where: { owner: provider.owner },
                transaction: t
            });
            if (providerStatus) {
                for (const node of providerStatus.nodes) {
                    const providerSnapshotNode = yield akash_1.ProviderSnapshotNode.create({
                        snapshotId: createdSnapshot.id,
                        name: node.name,
                        cpuAllocatable: node.cpuAllocatable,
                        cpuAllocated: node.cpuAllocated,
                        memoryAllocatable: node.memoryAllocatable,
                        memoryAllocated: node.memoryAllocated,
                        ephemeralStorageAllocatable: node.ephemeralStorageAllocatable,
                        ephemeralStorageAllocated: node.ephemeralStorageAllocated,
                        capabilitiesStorageHDD: node.capabilitiesStorageHDD,
                        capabilitiesStorageSSD: node.capabilitiesStorageSSD,
                        capabilitiesStorageNVME: node.capabilitiesStorageNVME,
                        gpuAllocatable: node.gpuAllocatable,
                        gpuAllocated: node.gpuAllocated
                    }, { transaction: t });
                    yield akash_1.ProviderSnapshotNodeCPU.bulkCreate(node.cpus.map((cpuInfo) => ({
                        snapshotNodeId: providerSnapshotNode.id,
                        vendor: cpuInfo.vendor,
                        model: cpuInfo.model,
                        vcores: cpuInfo.vcores
                    })), { transaction: t });
                    yield akash_1.ProviderSnapshotNodeGPU.bulkCreate(node.gpus.map((gpuInfo) => ({
                        snapshotNodeId: providerSnapshotNode.id,
                        vendor: gpuInfo.vendor,
                        name: gpuInfo.name,
                        modelId: gpuInfo.modelId,
                        interface: gpuInfo.interface,
                        memorySize: gpuInfo.memorySize
                    })), { transaction: t });
                }
            }
        }));
    });
}
function getNextCheckDate(successful, checkDate, downtimeStartDate) {
    if (successful) {
        return (0, date_fns_1.add)(checkDate, { seconds: UptimeCheckIntervalSeconds });
    }
    if ((0, date_fns_1.differenceInMinutes)(checkDate, downtimeStartDate) < 15) {
        return (0, date_fns_1.add)(checkDate, { minutes: 1 });
    }
    else if ((0, date_fns_1.differenceInHours)(checkDate, downtimeStartDate) < 1) {
        return (0, date_fns_1.add)(checkDate, { minutes: 5 });
    }
    else if ((0, date_fns_1.differenceInHours)(checkDate, downtimeStartDate) < 6) {
        return (0, date_fns_1.add)(checkDate, { minutes: 15 });
    }
    else if ((0, date_fns_1.differenceInHours)(checkDate, downtimeStartDate) < 24) {
        return (0, date_fns_1.add)(checkDate, { minutes: 30 });
    }
    else if ((0, date_fns_1.differenceInDays)(checkDate, downtimeStartDate) < 7) {
        return (0, date_fns_1.add)(checkDate, { hours: 1 });
    }
    else {
        return (0, date_fns_1.add)(checkDate, { hours: 24 });
    }
}
//# sourceMappingURL=providerStatusProvider.js.map