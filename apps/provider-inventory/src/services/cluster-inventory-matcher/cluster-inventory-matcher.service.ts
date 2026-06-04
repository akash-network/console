import { singleton } from "tsyringe";

import { canAllocate } from "@src/domain/resource-pair/resource-pair";
import { matchesGPU, type ParsedGPUAttributes } from "../../mappers/gpu-attribute-parser/gpu-attribute-parser";
import type { ClusterState, MatchResult, NodeState, RequestedResourceUnit } from "../../types/inventory";

const FAIL_NODE = Object.freeze({ nodeOk: false, clusterOk: true } as const);
const FAIL_CLUSTER = Object.freeze({ nodeOk: false, clusterOk: false } as const);
const GPU_CHECK_FAIL = Object.freeze({ ok: false } as const);
const NO_CAPACITY = Object.freeze({ matched: false, error: "INSUFFICIENT_CAPACITY" } as MatchResult);
const MATCHED = Object.freeze({ matched: true } as MatchResult);
const EMPTY_NODES = Object.freeze([] as readonly NodeState[]);

@singleton()
export class ClusterInventoryMatcherService {
  match(cluster: ClusterState | undefined, resourceUnits: RequestedResourceUnit[]): MatchResult {
    if (!cluster) return NO_CAPACITY;

    const clusterNodes = cluster.nodes ?? EMPTY_NODES;
    const nodeCount = clusterNodes.length;
    const nodeDeltas: NodeDelta[] = new Array(nodeCount);
    for (let i = 0; i < nodeCount; i++) {
      nodeDeltas[i] = { cpu: 0n, mem: 0n, eph: 0n, gpu: 0n };
    }
    const storageDeltas: Record<string, bigint> = Object.create(null);

    for (let i = resourceUnits.length - 1; i >= 0; i--) {
      const group = resourceUnits[i];
      let canonical: CanonicalHardware = { gpuSpecs: null, cpuFingerprint: group.resources.cpu.fingerprint };

      let remaining = group.count;

      for (let nodeIdx = 0; nodeIdx < nodeCount && remaining > 0; ) {
        const result = this.#tryAdjust(clusterNodes[nodeIdx], nodeDeltas[nodeIdx], cluster.storage, storageDeltas, group, canonical);
        if (!result.clusterOk) return NO_CAPACITY;

        if (result.nodeOk) {
          const delta = nodeDeltas[nodeIdx];
          delta.cpu += result.stageCpu;
          delta.mem += result.stageMem;
          delta.eph += result.stageEph;
          delta.gpu += result.stageGpu;
          if (result.stageStorage) {
            for (const s of result.stageStorage) {
              storageDeltas[s.class] = (storageDeltas[s.class] ?? 0n) + s.quantity;
            }
          }
          canonical = result.canonical;
          remaining--;
        } else {
          // increment node index only if the current node cannot allocate resources for the resource unit
          nodeIdx++;
        }
      }

      if (remaining > 0) {
        return NO_CAPACITY;
      }
    }

    return MATCHED;
  }

  #tryAdjust(
    node: NodeState,
    baseDelta: NodeDelta,
    clusterStorage: ClusterState["storage"],
    storageDeltas: Record<string, bigint>,
    group: RequestedResourceUnit,
    canonical: CanonicalHardware
  ): AttemptResult {
    if (!canAllocate(node.cpu, group.resources.cpu.units + baseDelta.cpu)) return FAIL_NODE;
    if (!canAllocate(node.memory, group.resources.memory.quantity + baseDelta.mem)) return FAIL_NODE;
    if (!canAllocate(node.gpu.quantity, group.resources.gpu.units + baseDelta.gpu)) return FAIL_NODE;

    let stageMem = group.resources.memory.quantity;
    let stageEph = 0n;
    let stageStorage: StorageStage[] | null = null;

    for (const vol of group.resources.storage) {
      const attrs = vol.attributes;

      if (attrs.classification === "ram") {
        const next = stageMem + vol.quantity;
        if (!canAllocate(node.memory, next + baseDelta.mem)) return FAIL_NODE;
        stageMem = next;
        continue;
      }

      if (attrs.classification === "ephemeral") {
        const next = stageEph + vol.quantity;
        if (!canAllocate(node.ephemeralStorage, next + baseDelta.eph)) return FAIL_NODE;
        stageEph = next;
        continue;
      }

      if (attrs.classification === "persistent") {
        if (!node.storageClasses?.includes(attrs.class)) return FAIL_NODE;
        const pool = clusterStorage?.[attrs.class];
        if (!pool) return FAIL_CLUSTER;

        const existing = stageStorage?.find(s => s.class === attrs.class);
        const classDelta = (storageDeltas[attrs.class] ?? 0n) + (existing?.quantity ?? 0n);
        if (!canAllocate(pool.quantity, vol.quantity + classDelta)) return FAIL_CLUSTER;

        if (existing) {
          existing.quantity += vol.quantity;
        } else {
          if (!stageStorage) stageStorage = [];
          stageStorage.push({ class: attrs.class, quantity: vol.quantity });
        }
      }
    }

    let resolvedGpuSpecs: ParsedGPUAttributes | undefined;
    if (group.resources.gpu.units > 0n) {
      const effectiveSpecs = canonical.gpuSpecs ? [canonical.gpuSpecs] : group.resources.gpu.attributes;
      const gpuResult = this.#tryAdjustGPU(node, group.resources.gpu.units, effectiveSpecs);
      if (!gpuResult.ok) return FAIL_NODE;
      resolvedGpuSpecs = gpuResult.resolved;
    }

    return {
      nodeOk: true,
      clusterOk: true,
      canonical: resolvedGpuSpecs ? { ...canonical, gpuSpecs: resolvedGpuSpecs } : canonical,
      stageCpu: group.resources.cpu.units,
      stageMem,
      stageEph,
      stageGpu: group.resources.gpu.units,
      stageStorage
    };
  }

  #tryAdjustGPU(node: NodeState, requestedUnits: bigint, gpuSpecs: ParsedGPUAttributes[]): { ok: boolean; resolved?: ParsedGPUAttributes } {
    if (!node.gpu?.info || node.gpu.info.length === 0) return GPU_CHECK_FAIL;

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
          vendor: info.vendor,
          model: info.name,
          ram: info.memorySize || null,
          interface: info.interface || null
        };
      }

      remaining--;
      if (remaining === 0) break;
    }

    if (remaining > 0) return GPU_CHECK_FAIL;

    return {
      ok: true,
      resolved: pinnedSpec!
    };
  }
}

interface CanonicalHardware {
  gpuSpecs: ParsedGPUAttributes | null;
  cpuFingerprint: string | null;
}

interface NodeDelta {
  cpu: bigint;
  mem: bigint;
  eph: bigint;
  gpu: bigint;
}

interface StorageStage {
  class: string;
  quantity: bigint;
}

type AttemptResult =
  | { nodeOk: false; clusterOk: boolean }
  | {
      nodeOk: true;
      clusterOk: true;
      canonical: CanonicalHardware;
      stageCpu: bigint;
      stageMem: bigint;
      stageEph: bigint;
      stageGpu: bigint;
      stageStorage: StorageStage[] | null;
    };
