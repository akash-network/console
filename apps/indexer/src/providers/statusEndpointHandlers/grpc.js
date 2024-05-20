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
exports.fetchProviderStatusFromGRPC = void 0;
const grpc_js_1 = require("@akashnetwork/akash-api/akash/provider/v1/grpc-js");
const protobuf_1 = require("@akashnetwork/akash-api/google/protobuf");
const util_1 = require("util");
const memoize_1 = __importDefault(require("lodash/memoize"));
const files_1 = require("@src/shared/utils/files");
const fake_insecure_credentials_1 = require("./fake-insecure-credentials");
function fetchProviderStatusFromGRPC(provider, timeout) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield queryStatus(provider.hostUri, timeout);
        const activeResources = parseResources(data.cluster.inventory.reservations.active.resources);
        const pendingResources = parseResources(data.cluster.inventory.reservations.pending.resources);
        const availableResources = data.cluster.inventory.cluster.nodes
            .map((x) => getAvailableResources(x.resources))
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
        return {
            resources: {
                deploymentCount: data.manifest.deployments,
                leaseCount: (_a = data.cluster.leases.active) !== null && _a !== void 0 ? _a : 0,
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
            nodes: data.cluster.inventory.cluster.nodes.map((node) => {
                const parsedResources = parseNodeResources(node.resources);
                return {
                    name: node.name,
                    cpuAllocatable: parsedResources.allocatableCPU,
                    cpuAllocated: parsedResources.allocatedCPU,
                    memoryAllocatable: parsedResources.allocatableMemory,
                    memoryAllocated: parsedResources.allocatedMemory,
                    ephemeralStorageAllocatable: parsedResources.allocatableStorage,
                    ephemeralStorageAllocated: parsedResources.allocatedStorage,
                    capabilitiesStorageHDD: node.capabilities.storageClasses.includes("beta1"),
                    capabilitiesStorageSSD: node.capabilities.storageClasses.includes("beta2"),
                    capabilitiesStorageNVME: node.capabilities.storageClasses.includes("beta3"),
                    gpuAllocatable: parsedResources.allocatableGPU,
                    gpuAllocated: parsedResources.allocatedGPU,
                    cpus: node.resources.cpu.info.map((cpuInfo) => ({
                        vendor: cpuInfo.vendor,
                        model: cpuInfo.model,
                        vcores: cpuInfo.vcores
                    })),
                    gpus: node.resources.gpu.info.map((gpuInfo) => ({
                        vendor: gpuInfo.vendor,
                        name: gpuInfo.name,
                        modelId: gpuInfo.modelid,
                        interface: gpuInfo.interface,
                        memorySize: gpuInfo.memorySize // TODO: Change type to bytes?
                    }))
                };
            })
        };
    });
}
exports.fetchProviderStatusFromGRPC = fetchProviderStatusFromGRPC;
function queryStatus(hostUri, timeout) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield createProviderClient(hostUri).getStatus(timeout);
    });
}
const createProviderClient = (0, memoize_1.default)((hostUri) => {
    // TODO: fetch port from chain
    const url = hostUri.replace(":8443", ":8444").replace("https://", "dns:///");
    // TODO: refactor to use on-change cert validation
    //  Issue: https://github.com/akash-network/cloudmos/issues/170
    const client = new grpc_js_1.ProviderRPCClient(url, fake_insecure_credentials_1.FakeInsecureCredentials.createInsecure());
    const getStatus = (0, util_1.promisify)(client.getStatus.bind(client));
    return {
        getStatus: (timeout) => getStatus(protobuf_1.Empty, { deadline: Date.now() + timeout })
    };
});
function parseResources(resources) {
    return {
        cpu: Math.round((0, files_1.parseDecimalKubernetesString)(resources.cpu.string) * 1000),
        memory: (0, files_1.parseSizeStr)(resources.memory.string),
        storage: (0, files_1.parseSizeStr)(resources.ephemeralStorage.string),
        gpu: (0, files_1.parseDecimalKubernetesString)(resources.gpu.string)
    };
}
function parseNodeResources(resources) {
    return {
        allocatableCPU: Math.round((0, files_1.parseDecimalKubernetesString)(resources.cpu.quantity.allocatable.string) * 1000),
        allocatedCPU: Math.round((0, files_1.parseDecimalKubernetesString)(resources.cpu.quantity.allocated.string) * 1000),
        allocatableMemory: (0, files_1.parseSizeStr)(resources.memory.quantity.allocatable.string),
        allocatedMemory: (0, files_1.parseSizeStr)(resources.memory.quantity.allocated.string),
        allocatableStorage: (0, files_1.parseSizeStr)(resources.ephemeralStorage.allocatable.string),
        allocatedStorage: (0, files_1.parseSizeStr)(resources.ephemeralStorage.allocated.string),
        allocatableGPU: (0, files_1.parseDecimalKubernetesString)(resources.gpu.quantity.allocatable.string),
        allocatedGPU: (0, files_1.parseDecimalKubernetesString)(resources.gpu.quantity.allocated.string)
    };
}
function getAvailableResources(resources) {
    const parsedResources = parseNodeResources(resources);
    // Setting minimum to 0 to prevent negative values due to overcommit
    // https://github.com/akash-network/docs/blob/master/operator/provider/README.md#cluster-resources-overcommit
    return {
        cpu: Math.max(0, parsedResources.allocatableCPU - parsedResources.allocatedCPU),
        memory: Math.max(0, parsedResources.allocatableMemory - parsedResources.allocatedMemory),
        storage: Math.max(0, parsedResources.allocatableStorage - parsedResources.allocatedStorage),
        gpu: Math.max(0, parsedResources.allocatableGPU - parsedResources.allocatedGPU)
    };
}
//# sourceMappingURL=grpc.js.map