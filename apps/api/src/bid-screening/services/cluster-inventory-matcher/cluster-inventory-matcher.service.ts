import { singleton } from "tsyringe";

import { mapSnapshotToInventory } from "@src/bid-screening/lib/inventory-mapper";
import { ProviderWithSnapshot } from "@src/bid-screening/types/provider";
import { matchesGPU, type ParsedGPUAttributes, parseGPUAttributes } from "../../lib/gpu-attribute-parser";
import { parseStorageAttributes } from "../../lib/storage-attribute-parser";
import type { ClusterState, MatchResult, NodeState, RequestedResourceUnit, ResourceAttribute } from "../../types/inventory.types";

interface CanonicalHardware {
  gpuSpecs: ParsedGPUAttributes | null;
  cpuFingerprint: string | null;
}

const FAIL_NODE = Object.freeze({ nodeOk: false, clusterOk: true });
const FAIL_CLUSTER = Object.freeze({ nodeOk: false, clusterOk: false });
const GPU_CHECK_FAIL = Object.freeze({ ok: false });
const NO_CAPACITY = Object.freeze({ matched: false, error: "INSUFFICIENT_CAPACITY" } as MatchResult);
const GROUP_MISMATCH = Object.freeze({ matched: false, error: "GROUP_RESOURCE_MISMATCH" } as MatchResult);

@singleton()
export class ClusterInventoryMatcherService {
  match(provider: ProviderWithSnapshot, resourceUnits: RequestedResourceUnit[]): MatchResult {
    const inventory = mapSnapshotToInventory(provider);
    return this.#adjust(inventory, resourceUnits);
  }

  #adjust(cluster: ClusterState, resourceUnits: RequestedResourceUnit[]): MatchResult {
    let canonical: CanonicalHardware = { gpuSpecs: null, cpuFingerprint: null };

    for (let i = resourceUnits.length - 1; i >= 0; i--) {
      const group = resourceUnits[i];

      const groupCpuFingerprint = getAttributeFingerprint(group.resources.cpu.attributes);
      if (canonical.cpuFingerprint && groupCpuFingerprint && canonical.cpuFingerprint !== groupCpuFingerprint) {
        return GROUP_MISMATCH;
      }

      let remaining = group.count;

      for (let nodeIdx = 0; nodeIdx < cluster.nodes.length && remaining > 0; ) {
        const result = this.#tryAdjust(cluster.nodes[nodeIdx], group, cluster.storage, canonical);
        if (!result.clusterOk) return NO_CAPACITY;

        if (result.nodeOk === true) {
          cluster.nodes[nodeIdx] = result.newNode ?? cluster.nodes[nodeIdx];
          cluster.storage = result.newClusterStorage ?? cluster.storage;
          canonical = result.canonical ?? canonical;
          remaining--;
        } else {
          // increment node index only if the current node cannot allocate resources for the resource unit
          nodeIdx++;
        }
      }

      if (remaining > 0) {
        return NO_CAPACITY;
      }

      if (canonical.cpuFingerprint === null) {
        canonical = { ...canonical, cpuFingerprint: groupCpuFingerprint };
      }
    }

    return { matched: true };
  }

  #tryAdjust(
    node: NodeState,
    group: RequestedResourceUnit,
    clusterStorage: ClusterState["storage"],
    canonical: CanonicalHardware
  ): {
    nodeOk: boolean;
    clusterOk: boolean;
    canonical?: CanonicalHardware;
    newNode?: NodeState;
    newClusterStorage?: ClusterState["storage"];
  } {
    if (!node.cpu.canAllocate(group.resources.cpu.units)) return FAIL_NODE;
    if (!node.memory.canAllocate(group.resources.memory.quantity)) return FAIL_NODE;
    if (!node.gpu.quantity.canAllocate(group.resources.gpu.units)) return FAIL_NODE;

    const nodeCopy = copyNode(node);
    nodeCopy.cpu.allocate(group.resources.cpu.units);
    nodeCopy.memory.allocate(group.resources.memory.quantity);

    const storageCopies = Object.values(clusterStorage).reduce<ClusterState["storage"]>((acc, storage) => {
      acc[storage.class] = { ...storage, quantity: storage.quantity.clone() };
      return acc;
    }, Object.create(null));

    for (const vol of group.resources.storage) {
      const storageResult = this.#tryAdjustStorage(nodeCopy, vol, storageCopies);
      if (!storageResult.nodeOk) return storageResult;
    }

    let resolvedGpuSpecs: ParsedGPUAttributes | undefined;
    if (group.resources.gpu.units > 0n) {
      const effectiveSpecs = canonical.gpuSpecs ? [canonical.gpuSpecs] : parseGPUAttributes(group.resources.gpu.attributes);
      const gpuResult = this.#tryAdjustGPU(nodeCopy, group.resources.gpu.units, effectiveSpecs);
      if (!gpuResult.ok) return FAIL_NODE;
      resolvedGpuSpecs = gpuResult.resolved;
    }

    return {
      nodeOk: true,
      clusterOk: true,
      canonical: {
        gpuSpecs: resolvedGpuSpecs ?? canonical.gpuSpecs,
        cpuFingerprint: canonical.cpuFingerprint
      },
      newNode: nodeCopy,
      newClusterStorage: storageCopies
    };
  }

  #tryAdjustStorage(
    node: NodeState,
    vol: RequestedResourceUnit["resources"]["storage"][0],
    clusterStorage: ClusterState["storage"]
  ): { nodeOk: boolean; clusterOk: boolean } {
    const parsed = parseStorageAttributes(vol.attributes);

    if (parsed.classification === "ram") {
      if (!node.memory.allocate(vol.quantity)) return FAIL_NODE;
      return { nodeOk: true, clusterOk: true };
    }

    if (parsed.classification === "ephemeral") {
      if (!node.ephemeralStorage.allocate(vol.quantity)) return FAIL_NODE;
      return { nodeOk: true, clusterOk: true };
    }

    if (parsed.classification === "persistent") {
      if (!node.storageClasses.includes(parsed.class)) return FAIL_NODE;
      const pool = clusterStorage[parsed.class];
      if (!pool?.quantity.allocate(vol.quantity)) return FAIL_CLUSTER;
      return { nodeOk: true, clusterOk: true };
    }

    return { nodeOk: true, clusterOk: true };
  }

  #tryAdjustGPU(node: NodeState, requestedUnits: bigint, gpuSpecs: ParsedGPUAttributes[]): { ok: boolean; resolved?: ParsedGPUAttributes } {
    if (node.gpu.info.length === 0) return GPU_CHECK_FAIL;
    if (!node.gpu.quantity.canAllocate(requestedUnits)) return GPU_CHECK_FAIL;

    if (gpuSpecs.length === 0) {
      const first = node.gpu.info[0];
      return this.#tryAdjustGPU(node, requestedUnits, [
        {
          vendor: first.vendor,
          model: first.name,
          ram: first.memorySize || null,
          interface: first.interface || null
        }
      ]);
    }

    let remaining = Number(requestedUnits);
    let pinnedSpec: ParsedGPUAttributes | undefined;

    for (const info of node.gpu.info) {
      if (pinnedSpec) {
        if (!matchesGPU(pinnedSpec, info)) continue;
      } else {
        const attr = gpuSpecs.find(spec => matchesGPU(spec, info));
        if (!attr) continue;

        pinnedSpec = {
          vendor: info.vendor.toLowerCase(),
          model: info.name,
          ram: info.memorySize || null,
          interface: info.interface || null
        };
      }

      remaining--;
      if (remaining === 0) break;
    }

    if (remaining > 0) return GPU_CHECK_FAIL;

    if (!node.gpu.quantity.allocate(requestedUnits)) return GPU_CHECK_FAIL;

    return {
      ok: true,
      resolved: pinnedSpec!
    };
  }
}

function copyNode(node: NodeState): NodeState {
  return {
    name: node.name,
    cpu: node.cpu.clone(),
    memory: node.memory.clone(),
    ephemeralStorage: node.ephemeralStorage.clone(),
    gpu: {
      quantity: node.gpu.quantity.clone(),
      info: node.gpu.info.map(g => ({ ...g }))
    },
    storageClasses: [...node.storageClasses],
    cpus: node.cpus.map(c => ({ ...c }))
  };
}

function getAttributeFingerprint(attributes: ResourceAttribute[]): string | null {
  if (attributes.length === 0) return null;
  return attributes
    .map(a => `${a.key}=${a.value}`)
    .sort()
    .join(",");
}
