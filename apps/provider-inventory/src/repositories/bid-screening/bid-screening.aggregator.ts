import { parseGPUAttributes } from "@src/lib/gpu-attribute-parser/gpu-attribute-parser";
import type { GroupSpecJSON } from "@src/lib/groupspec-mapper/groupspec-mapper";
import { parseStorageAttributes } from "@src/lib/storage-attribute-parser/storage-attribute-parser";
import type { RequestedResourceUnit, ResourceAttribute } from "@src/types/inventory.types";

interface UnitFilters {
  gpuTokens: string[];
  persistentClasses: string[];
}

export interface BidScreeningCriteria {
  totalCpu: bigint;
  totalMemory: bigint;
  totalGpu: bigint;
  totalEphemeralStorage: bigint;
  totalPersistentStorage: bigint;
  maxPerReplicaCpu: bigint;
  maxPerReplicaMemory: bigint;
  maxPerReplicaGpu: bigint;
  attributes: { key: string; value: string }[];
  globAttributes: { keyPattern: string; value: string }[];
  signedBy: { allOf: string[]; anyOf: string[] };
  units: UnitFilters[];
}

export function aggregateCriteria(resourceUnits: RequestedResourceUnit[], requirements: GroupSpecJSON["requirements"]): BidScreeningCriteria {
  let totalCpu = 0n;
  let totalMemory = 0n;
  let totalGpu = 0n;
  let totalEphemeralStorage = 0n;
  let totalPersistentStorage = 0n;
  let maxPerReplicaCpu = 0n;
  let maxPerReplicaMemory = 0n;
  let maxPerReplicaGpu = 0n;
  const units: UnitFilters[] = [];

  for (const unit of resourceUnits) {
    const count = BigInt(unit.count);
    const cpu = unit.resources.cpu.units;
    const memory = unit.resources.memory.quantity;
    const gpu = unit.resources.gpu.units;

    totalCpu += cpu * count;
    totalMemory += memory * count;
    totalGpu += gpu * count;

    if (cpu > maxPerReplicaCpu) maxPerReplicaCpu = cpu;
    if (memory > maxPerReplicaMemory) maxPerReplicaMemory = memory;
    if (gpu > maxPerReplicaGpu) maxPerReplicaGpu = gpu;

    for (const vol of unit.resources.storage) {
      const parsed = parseStorageAttributes(vol.attributes);
      if (parsed.classification === "persistent") {
        totalPersistentStorage += vol.quantity * count;
      } else if (parsed.classification === "ephemeral") {
        totalEphemeralStorage += vol.quantity * count;
      }
      // ram volumes intentionally skipped — issue 4 will add them to totalMemory
    }

    units.push({ gpuTokens: gpuTokensForUnit(unit.resources.gpu), persistentClasses: [] });
  }

  const attributes: BidScreeningCriteria["attributes"] = [];
  const globAttributes: BidScreeningCriteria["globAttributes"] = [];

  for (const attr of requirements.attributes) {
    if (attr.key.endsWith("*")) {
      const prefix = attr.key.slice(0, -1);
      globAttributes.push({ keyPattern: `^${escapeRegex(prefix)}[^/]*$`, value: attr.value });
    } else {
      attributes.push({ key: attr.key, value: attr.value });
    }
  }

  return {
    totalCpu,
    totalMemory,
    totalGpu,
    totalEphemeralStorage,
    totalPersistentStorage,
    maxPerReplicaCpu,
    maxPerReplicaMemory,
    maxPerReplicaGpu,
    attributes,
    globAttributes,
    signedBy: {
      allOf: requirements.signedBy.allOf,
      anyOf: requirements.signedBy.anyOf
    },
    units
  };
}

// The SDL attribute key regex (enforced upstream in BidScreeningService) admits only
// [a-zA-Z][\w\/\.\-]*[\w\*]?, so the only regex special that can appear in the prefix is `.`.
function escapeRegex(input: string): string {
  return input.replace(/[\\.^$*+?()[\]{}|]/g, "\\$&");
}

function gpuTokensForUnit(gpu: { units: bigint; attributes: ResourceAttribute[] }): string[] {
  if (gpu.units === 0n) return [];
  const tokens: string[] = [];
  for (const parsed of parseGPUAttributes(gpu.attributes)) {
    const token = parsed.model === "*" ? parsed.vendor : `${parsed.vendor}/${parsed.model}`;
    if (!tokens.includes(token)) tokens.push(token);
  }
  return tokens;
}
