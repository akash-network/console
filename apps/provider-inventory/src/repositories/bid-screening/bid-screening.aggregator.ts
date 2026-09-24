import type { ParsedGPUAttributes } from "@src/mappers/gpu-attribute-parser/gpu-attribute-parser";
import type { GroupSpecJSON } from "@src/mappers/groupspec-mapper/groupspec-mapper";
import type { RequestedResourceUnit, RequestedStorage, ResourceAttribute } from "@src/types/inventory";

interface UnitFilters {
  gpuTokens: string[];
  gpuCapabilities: { keyPattern: string; value: string }[];
  persistentClasses: string[];
  storageCapabilities: ResourceAttribute[][];
}

export interface BidScreeningCriteria {
  totalCpu: bigint;
  totalMemory: bigint;
  totalGpu: bigint;
  totalEphemeralStorage: bigint;
  totalPersistentStorage: bigint;
  totalLeasedIps: bigint;
  maxPerReplicaCpu: bigint;
  maxPerReplicaMemory: bigint;
  maxPerReplicaGpu: bigint;
  attributes: { key: string; value: string }[];
  globAttributes: { keyPattern: string; value: string }[];
  signedBy: { allOf: string[]; anyOf: string[] };
  units: UnitFilters[];
  reclamationWindow?: number;
}

export function aggregateCriteria(resourceUnits: RequestedResourceUnit[], requirements: PlacementRequirements): BidScreeningCriteria {
  let totalCpu = 0n;
  let totalMemory = 0n;
  let totalGpu = 0n;
  let totalEphemeralStorage = 0n;
  let totalPersistentStorage = 0n;
  let maxPerReplicaCpu = 0n;
  let maxPerReplicaMemory = 0n;
  let maxPerReplicaGpu = 0n;
  const units: UnitFilters[] = [];
  const leasedIps = new Set<number>();

  for (const unit of resourceUnits) {
    const count = BigInt(unit.count);
    const cpu = unit.resources.cpu.units;
    const gpu = unit.resources.gpu.units;

    let effectiveMemory = unit.resources.memory.quantity;
    for (const vol of unit.resources.storage) {
      const parsed = vol.attributes;
      if (parsed.classification === "persistent") {
        totalPersistentStorage += vol.quantity * count;
      } else if (parsed.classification === "ephemeral") {
        totalEphemeralStorage += vol.quantity * count;
      } else if (parsed.classification === "ram") {
        effectiveMemory += vol.quantity;
      }
    }

    for (const endpoint of unit.resources.endpoints) {
      if (endpoint.kind === "LEASED_IP") {
        leasedIps.add(endpoint.sequenceNumber);
      }
    }

    totalCpu += cpu * count;
    totalMemory += effectiveMemory * count;
    totalGpu += gpu * count;

    if (cpu > maxPerReplicaCpu) maxPerReplicaCpu = cpu;
    if (effectiveMemory > maxPerReplicaMemory) maxPerReplicaMemory = effectiveMemory;
    if (gpu > maxPerReplicaGpu) maxPerReplicaGpu = gpu;

    units.push({
      gpuTokens: collectGpuTokens(unit.resources.gpu),
      gpuCapabilities: collectGpuCapabilities(unit.resources.gpu),
      persistentClasses: collectPersistentStorageTokens(unit.resources.storage),
      storageCapabilities: unit.resources.storage.map(vol => vol.capabilities).filter(capabilities => capabilities.length > 0)
    });
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
    totalLeasedIps: BigInt(leasedIps.size),
    maxPerReplicaCpu,
    maxPerReplicaMemory,
    maxPerReplicaGpu,
    attributes,
    globAttributes,
    signedBy: {
      allOf: requirements.signedBy.allOf,
      anyOf: requirements.signedBy.anyOf
    },
    units,
    reclamationWindow: requirements.reclamationWindow
  };
}

// The SDL attribute key regex (enforced upstream in BidScreeningService) admits only
// [a-zA-Z][\w\/\.\-]*[\w\*]?, so the only regex special that can appear in the prefix is `.`.
function escapeRegex(input: string): string {
  return input.replace(/[\\.^$*+?()[\]{}|]/g, "\\$&");
}

function collectGpuTokens(gpu: { units: bigint; attributes: ParsedGPUAttributes[] }): string[] {
  if (gpu.units === 0n) return [];
  const tokens: string[] = [];
  for (const parsed of gpu.attributes) {
    const token = parsed.model === "*" ? parsed.vendor : `${parsed.vendor}/${parsed.model}`;
    if (!tokens.includes(token)) tokens.push(token);
  }
  return tokens;
}

/** The bid engine reads an order's GPU key as a path pattern over the provider's advertised `capabilities/gpu/...` keys, where only a trailing `*` is a wildcard and it never crosses a `/`. */
function collectGpuCapabilities(gpu: { units: bigint; capabilities: ResourceAttribute[] }): UnitFilters["gpuCapabilities"] {
  if (gpu.units === 0n) return [];
  return gpu.capabilities.map(capability => ({ keyPattern: toAdvertisedGpuKeyPattern(capability.key), value: capability.value }));
}

function toAdvertisedGpuKeyPattern(key: string): string {
  const spansLastSegment = key.endsWith("*");
  const literal = spansLastSegment ? key.slice(0, -1) : key;
  return `^capabilities/gpu/${escapeRegex(literal)}${spansLastSegment ? "[^/]*" : ""}$`;
}

function collectPersistentStorageTokens(storage: RequestedStorage[]): string[] {
  const tokens: string[] = [];
  for (const vol of storage) {
    const parsed = vol.attributes;
    if (parsed.classification === "persistent" && parsed.class && !tokens.includes(parsed.class)) {
      tokens.push(parsed.class);
    }
  }
  return tokens;
}

export interface PlacementRequirements extends Exclude<GroupSpecJSON["requirements"], undefined> {
  reclamationWindow?: number;
}
