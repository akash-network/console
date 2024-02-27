import { Provider } from "@shared/dbSchemas/akash";
import { parseDecimalKubernetesString, parseSizeStr } from "@src/shared/utils/files";
import { createPromiseClient } from "@connectrpc/connect";
import { createGrpcTransport } from "@connectrpc/connect-node";
import { ProviderRPC } from "@src/proto/gen/akash/provider/v1/service_connect";
import { ResourcesMetric, Status } from "@src/proto/gen/akash/provider/v1/status_pb";
import { NodeResources } from "@src/proto/gen/akash/inventory/v1/resources_pb";
import { ProviderStatusInfo } from "./types";

export async function fetchAndSaveProviderStats(provider: Provider, cosmosSdkVersion: string, version: string, timeout: number): Promise<ProviderStatusInfo> {
  const data = await queryStatus(provider.hostUri, timeout);

  const activeResources = parseResources(data.cluster.inventory.reservations.active.resources);
  const pendingResources = parseResources(data.cluster.inventory.reservations.pending.resources);
  const availableResources = data.cluster.inventory.cluster.nodes
    .map((x) => getAvailableResources(x.resources))
    .reduce(
      (prev, next) => ({
        cpu: prev.cpu + next.cpu,
        gpu: prev.gpu + next.gpu,
        memory: prev.memory + next.memory,
        storage: prev.storage + next.storage
      }),
      {
        cpu: 0,
        gpu: 0,
        memory: 0,
        storage: 0
      }
    );

  return {
    resources: {
      deploymentCount: data.manifest.deployments,
      leaseCount: data.cluster.leases.active ?? 0,
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
}

async function queryStatus(hostUri: string, timeout: number): Promise<Status> {
  const url = hostUri.replace(":8443", ":8444"); // Use 8444 as default GRPC port for now, enventually get from on-chain data

  const transport = createGrpcTransport({
    baseUrl: url,
    httpVersion: "2",
    nodeOptions: { rejectUnauthorized: false },
    defaultTimeoutMs: timeout,
    interceptors: []
  });
  const client = createPromiseClient(ProviderRPC, transport);
  const res = await client.getStatus({});

  return res;
}

function parseResources(resources: ResourcesMetric) {
  return {
    cpu: Math.round(parseDecimalKubernetesString(resources.cpu.string) * 1_000),
    memory: parseSizeStr(resources.memory.string),
    storage: parseSizeStr(resources.ephemeralStorage.string),
    gpu: parseDecimalKubernetesString(resources.gpu.string)
  };
}

function parseNodeResources(resources: NodeResources) {
  return {
    allocatableCPU: Math.round(parseDecimalKubernetesString(resources.cpu.quantity.allocatable.string) * 1_000),
    allocatedCPU: Math.round(parseDecimalKubernetesString(resources.cpu.quantity.allocated.string) * 1_000),
    allocatableMemory: parseSizeStr(resources.memory.quantity.allocatable.string),
    allocatedMemory: parseSizeStr(resources.memory.quantity.allocated.string),
    allocatableStorage: parseSizeStr(resources.ephemeralStorage.allocatable.string),
    allocatedStorage: parseSizeStr(resources.ephemeralStorage.allocated.string),
    allocatableGPU: parseDecimalKubernetesString(resources.gpu.quantity.allocatable.string),
    allocatedGPU: parseDecimalKubernetesString(resources.gpu.quantity.allocated.string)
  };
}

function getAvailableResources(resources: NodeResources) {
  const parsedResources = parseNodeResources(resources);
  return {
    cpu: parsedResources.allocatableCPU - parsedResources.allocatedCPU,
    memory: parsedResources.allocatableMemory - parsedResources.allocatedMemory,
    storage: parsedResources.allocatableStorage - parsedResources.allocatedStorage,
    gpu: parsedResources.allocatableGPU - parsedResources.allocatedGPU
  };
}
