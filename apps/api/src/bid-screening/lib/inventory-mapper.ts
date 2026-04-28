import type { ClusterState, CpuInfo, GpuInfo } from "../types/inventory.types";
import type { ProviderWithSnapshot } from "../types/provider";
import { ResourcePair } from "./resource-pair";

const STORAGE_CLASS_MAP: Record<string, string> = {
  capabilitiesStorageHDD: "beta1",
  capabilitiesStorageSSD: "beta2",
  capabilitiesStorageNVME: "beta3"
};

export function mapSnapshotToInventory(provider: ProviderWithSnapshot): ClusterState {
  const snapshot = provider.lastSuccessfulSnapshot;

  const nodes = snapshot.nodes.map(node => {
    const storageClasses: string[] = [];
    if (node.capabilitiesStorageHDD) storageClasses.push(STORAGE_CLASS_MAP.capabilitiesStorageHDD);
    if (node.capabilitiesStorageSSD) storageClasses.push(STORAGE_CLASS_MAP.capabilitiesStorageSSD);
    if (node.capabilitiesStorageNVME) storageClasses.push(STORAGE_CLASS_MAP.capabilitiesStorageNVME);

    const gpuInfo: GpuInfo[] = (node.gpus || [])
      .map(gpu => ({
        vendor: gpu.vendor,
        name: gpu.name,
        modelId: gpu.modelId,
        interface: gpu.interface,
        memorySize: gpu.memorySize
      }))
      .sort((a, b) => a.vendor.localeCompare(b.vendor) || a.name.localeCompare(b.name) || a.memorySize.localeCompare(b.memorySize));

    const cpuInfo: CpuInfo[] = (node.cpus || []).map(cpu => ({
      vendor: cpu.vendor,
      model: cpu.model
    }));

    return {
      name: node.name,
      cpu: new ResourcePair(BigInt(node.cpuAllocatable), BigInt(node.cpuAllocated)),
      memory: new ResourcePair(BigInt(node.memoryAllocatable), BigInt(node.memoryAllocated)),
      ephemeralStorage: new ResourcePair(BigInt(node.ephemeralStorageAllocatable), BigInt(node.ephemeralStorageAllocated)),
      gpu: {
        quantity: new ResourcePair(BigInt(node.gpuAllocatable), BigInt(node.gpuAllocated)),
        info: gpuInfo
      },
      storageClasses,
      cpus: cpuInfo
    };
  });

  const storage = (snapshot.storage || []).reduce<Record<string, { class: string; quantity: ResourcePair }>>((acc, pool) => {
    acc[pool.class] = {
      class: pool.class,
      quantity: new ResourcePair(BigInt(pool.allocatable), BigInt(pool.allocated))
    };
    return acc;
  }, Object.create(null));

  return { nodes, storage };
}
