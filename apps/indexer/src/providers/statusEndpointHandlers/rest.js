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
exports.fetchProviderStatusFromREST = void 0;
const axios_1 = __importDefault(require("axios"));
const https_1 = __importDefault(require("https"));
function fetchProviderStatusFromREST(provider, timeout) {
    return __awaiter(this, void 0, void 0, function* () {
        const httpsAgent = new https_1.default.Agent({
            rejectUnauthorized: false
        });
        const response = yield axios_1.default.get(provider.hostUri + "/status", {
            httpsAgent: httpsAgent,
            timeout: timeout
        });
        if (response.status !== 200)
            throw "Invalid response status: " + response.status;
        const activeResources = sumResources(response.data.cluster.inventory.active);
        const pendingResources = sumResources(response.data.cluster.inventory.pending);
        const availableResources = sumResources(response.data.cluster.inventory.available);
        return {
            resources: {
                deploymentCount: response.data.manifest.deployments,
                leaseCount: response.data.cluster.leases,
                activeCPU: activeResources.cpu,
                activeGPU: activeResources.gpu,
                activeMemory: activeResources.memory,
                activeStorage: activeResources.storage,
                pendingCPU: pendingResources.cpu,
                pendingGPU: pendingResources.gpu,
                pendingMemory: pendingResources.memory,
                pendingStorage: pendingResources.storage,
                availableCPU: availableResources.cpu,
                availableGPU: availableResources.gpu,
                availableMemory: availableResources.memory,
                availableStorage: availableResources.storage
            },
            nodes: []
        };
    });
}
exports.fetchProviderStatusFromREST = fetchProviderStatusFromREST;
function sumResources(resources) {
    const resourcesArr = (resources === null || resources === void 0 ? void 0 : resources.nodes) || resources || [];
    return resourcesArr
        .map((x) => ({
        cpu: getUnitValue(x.cpu),
        gpu: x.gpu ? getUnitValue(x.gpu) : 0,
        memory: getByteValue(x.memory),
        storage: getByteValue(getStorageFromResource(x))
    }))
        .reduce((prev, next) => ({
        cpu: prev.cpu + next.cpu,
        gpu: prev.gpu + next.gpu,
        memory: prev.memory + next.memory,
        storage: prev.storage + next.storage
    }), {
        cpu: 0,
        gpu: 0,
        memory: 0,
        storage: 0
    });
}
function getStorageFromResource(resource) {
    return Object.keys(resource).includes("storage_ephemeral") ? resource.storage_ephemeral : resource.storage;
}
function getUnitValue(resource) {
    return typeof resource === "number" ? resource : parseInt(resource.units.val);
}
function getByteValue(val) {
    return typeof val === "number" ? val : parseInt(val.size.val);
}
//# sourceMappingURL=rest.js.map