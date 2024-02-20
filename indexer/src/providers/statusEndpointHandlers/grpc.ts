import { Provider, ProviderSnapshot, ProviderSnapshotNode, ProviderSnapshotNodeCPU, ProviderSnapshotNodeGPU } from "@shared/dbSchemas/akash";
import { sequelize } from "@src/db/dbConnection";
import { toUTC } from "@src/shared/utils/date";
import { parseDecimalKubernetesString, parseSizeStr } from "@src/shared/utils/files";
import { isSameDay } from "date-fns";
import { createPromiseClient } from "@connectrpc/connect";
import { createGrpcTransport } from "@connectrpc/connect-node";
import { ProviderRPC } from "@src/proto/gen/akash/provider/v1/service_connect";
import { ResourcesMetric, Status } from "@src/proto/gen/akash/provider/v1/status_pb";
import { NodeResources } from "@src/proto/gen/akash/inventory/v1/resources_pb";

export async function fetchAndSaveProviderStats(provider: Provider, cosmosSdkVersion: string, version: string, timeout: number) {
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
  const checkDate = toUTC(new Date());

  await sequelize.transaction(async (t) => {
    const createdSnapshot = await ProviderSnapshot.create(
      {
        owner: provider.owner,
        isOnline: true,
        checkDate: checkDate,
        isLastOfDay: true,
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
      { transaction: t }
    );

    if (provider.lastSnapshot && isSameDay(provider.lastSnapshot.checkDate, checkDate)) {
      await ProviderSnapshot.update(
        {
          isLastOfDay: false
        },
        {
          where: { id: provider.lastSnapshot.id },
          transaction: t
        }
      );
    }

    await Provider.update(
      {
        lastSnapshotId: createdSnapshot.id,
        isOnline: true,
        error: null,
        lastCheckDate: checkDate,
        cosmosSdkVersion: cosmosSdkVersion,
        akashVersion: version,
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
      {
        where: { owner: provider.owner },
        transaction: t
      }
    );

    for (const node of data.cluster.inventory.cluster.nodes) {
      const parsedResources = parseNodeResources(node.resources);
      const providerSnapshotNode = await ProviderSnapshotNode.create(
        {
          snapshotId: createdSnapshot.id,
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
          gpuAllocated: parsedResources.allocatedGPU
        },
        { transaction: t }
      );

      for (const cpuInfo of node.resources.cpu.info) {
        await ProviderSnapshotNodeCPU.create(
          {
            snapshotNodeId: providerSnapshotNode.id,
            vendor: cpuInfo.vendor,
            model: cpuInfo.model,
            vcores: cpuInfo.vcores
          },
          { transaction: t }
        );
      }

      for (const gpuInfo of node.resources.gpu.info) {
        await ProviderSnapshotNodeGPU.create(
          {
            snapshotNodeId: providerSnapshotNode.id,
            vendor: gpuInfo.vendor,
            name: gpuInfo.name,
            modelId: gpuInfo.modelid,
            interface: gpuInfo.interface,
            memorySize: gpuInfo.memorySize // TODO: Change type to bytes?
          },
          { transaction: t }
        );
      }
    }
  });
}

async function queryStatus(hostUri: string, timeout: number): Promise<Status> {
  const url = hostUri.replace(":8443", ":8444"); // Use 8444 as default GRPC port for now, enventually get from on-chain data

  const transport = createGrpcTransport({
    baseUrl: url,
    httpVersion: "2",
    nodeOptions: { rejectUnauthorized: false },
    interceptors: []
  });
  const client = createPromiseClient(ProviderRPC, transport);
  const res = await client.getStatus({});

  return res;
}

function parseResources(resources: ResourcesMetric) {
  return {
    cpu: parseDecimalKubernetesString(resources.cpu.string) * 1_000,
    memory: parseSizeStr(resources.memory.string),
    storage: parseSizeStr(resources.ephemeralStorage.string),
    gpu: parseDecimalKubernetesString(resources.gpu.string)
  };
}

function parseNodeResources(resources: NodeResources) {
  return {
    allocatableCPU: parseDecimalKubernetesString(resources.cpu.quantity.allocatable.string) * 1_000,
    allocatedCPU: parseDecimalKubernetesString(resources.cpu.quantity.allocated.string) * 1_000,
    allocatableMemory: parseSizeStr(resources.memory.quantity.allocatable.string),
    allocatedMemory: parseSizeStr(resources.memory.quantity.allocated.string),
    allocatableStorage: parseSizeStr(resources.ephemeralStorage.allocatable.string),
    allocatedStorage: parseSizeStr(resources.ephemeralStorage.allocated.string),
    allocatableGPU: parseDecimalKubernetesString(resources.gpu.quantity.allocatable.string),
    allocatedGPU: parseDecimalKubernetesString(resources.gpu.quantity.allocatable.string)
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
