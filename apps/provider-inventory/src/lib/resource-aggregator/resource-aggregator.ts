import type { RequestedResourceUnit } from "../../types/inventory.types";
import { parseGPUAttributes } from "../gpu-attribute-parser/gpu-attribute-parser";
import { parseStorageAttributes } from "../storage-attribute-parser/storage-attribute-parser";

export interface ResourceAggregates {
  totalCpu: bigint;
  totalMemory: bigint;
  totalGpu: bigint;
  maxPerReplicaCpu: bigint;
  maxPerReplicaMemory: bigint;
  maxPerReplicaGpu: bigint;
  totalEphemeralStorage: bigint;
  totalPersistentStorage: bigint;
  gpuVendor?: string;
  gpuModel?: string;
  gpuRam?: string;
  gpuInterface?: string;
  persistentStorageClass?: string;
}

export function aggregateResourceUnits(units: RequestedResourceUnit[]): ResourceAggregates {
  let totalCpu = 0n;
  let totalMemory = 0n;
  let totalGpu = 0n;
  let maxPerReplicaCpu = 0n;
  let maxPerReplicaMemory = 0n;
  let maxPerReplicaGpu = 0n;
  let totalEphemeralStorage = 0n;
  let totalPersistentStorage = 0n;
  let gpuVendor: string | undefined;
  let gpuModel: string | undefined;
  let gpuRam: string | undefined;
  let gpuInterface: string | undefined;
  const storageClasses = new Set<string>();

  for (const unit of units) {
    const count = BigInt(unit.count);
    totalCpu += count * unit.resources.cpu.units;
    totalMemory += count * unit.resources.memory.quantity;
    totalGpu += count * unit.resources.gpu.units;

    if (unit.resources.cpu.units > maxPerReplicaCpu) {
      maxPerReplicaCpu = unit.resources.cpu.units;
    }
    if (unit.resources.memory.quantity > maxPerReplicaMemory) {
      maxPerReplicaMemory = unit.resources.memory.quantity;
    }

    if (unit.resources.gpu.units > 0n) {
      if (unit.resources.gpu.units > maxPerReplicaGpu) {
        maxPerReplicaGpu = unit.resources.gpu.units;
      }
      const gpuSpecs = parseGPUAttributes(unit.resources.gpu.attributes);
      if (gpuSpecs.length > 0) {
        const spec = gpuSpecs[gpuSpecs.length - 1];
        gpuVendor = spec.vendor;
        gpuModel = spec.model !== "*" ? spec.model : undefined;
        gpuRam = spec.ram ?? undefined;
        gpuInterface = spec.interface ?? undefined;
      }
    }

    for (const vol of unit.resources.storage) {
      const parsed = parseStorageAttributes(vol.attributes);
      if (parsed.classification === "ephemeral") {
        totalEphemeralStorage += count * vol.quantity;
      } else if (parsed.classification === "persistent") {
        totalPersistentStorage += count * vol.quantity;
        storageClasses.add(parsed.class);
      }
    }
  }

  return {
    totalCpu,
    totalMemory,
    totalGpu,
    maxPerReplicaCpu,
    maxPerReplicaMemory,
    maxPerReplicaGpu,
    totalEphemeralStorage,
    totalPersistentStorage,
    gpuVendor,
    gpuModel,
    gpuRam,
    gpuInterface,
    persistentStorageClass: storageClasses.size === 1 ? [...storageClasses][0] : undefined
  };
}
