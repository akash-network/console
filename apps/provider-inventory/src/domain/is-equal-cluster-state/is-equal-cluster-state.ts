import type { ClusterState, CpuInfo, GpuInfo, NodeState, RawPair } from "@src/types/inventory";

const EMPTY_PAIR: RawPair = { allocatable: 0n, allocated: 0n };

export function isEqualClusterState(a: ClusterState, b: ClusterState): boolean {
  if (a === b) return true;
  return clusterStorageEqual(a.storage, b.storage) && nodesEqual(a.nodes, b.nodes) && pairEqual(a.leasedIp ?? EMPTY_PAIR, b.leasedIp ?? EMPTY_PAIR);
}

function nodesEqual(a: readonly NodeState[] | undefined, b: readonly NodeState[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;

  const byName = new Map<string, NodeState>();
  for (let i = 0; i < a.length; i++) {
    byName.set(a[i].name, a[i]);
  }
  for (let i = 0; i < b.length; i++) {
    const match = byName.get(b[i].name);
    if (!match || !nodeEqual(match, b[i])) return false;
  }
  return true;
}

function nodeEqual(a: NodeState, b: NodeState): boolean {
  if (a === b) return true;
  return (
    pairEqual(a.cpu, b.cpu) &&
    pairEqual(a.memory, b.memory) &&
    pairEqual(a.ephemeralStorage, b.ephemeralStorage) &&
    pairEqual(a.gpu.quantity, b.gpu.quantity) &&
    gpuInfoEqual(a.gpu.info, b.gpu.info) &&
    stringArrayEqual(a.storageClasses, b.storageClasses) &&
    cpuInfoEqual(a.cpus, b.cpus)
  );
}

function pairEqual(a: RawPair, b: RawPair): boolean {
  return a.allocatable === b.allocatable && a.allocated === b.allocated;
}

function gpuInfoEqual(a: readonly GpuInfo[], b: readonly GpuInfo[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    const match = b.some(
      g => g.vendor === a[i].vendor && g.name === a[i].name && g.modelId === a[i].modelId && g.interface === a[i].interface && g.memorySize === a[i].memorySize
    );
    if (!match) return false;
  }
  return true;
}

function cpuInfoEqual(a: readonly CpuInfo[], b: readonly CpuInfo[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    const match = b.some(c => c.vendor === a[i].vendor && c.model === a[i].model);
    if (!match) return false;
  }
  return true;
}

function clusterStorageEqual(a: ClusterState["storage"], b: ClusterState["storage"]): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    const poolA = a[key];
    const poolB = b[key];
    if (!poolB) return false;
    if (poolA.class !== poolB.class) return false;
    if (!pairEqual(poolA.quantity, poolB.quantity)) return false;
  }
  return true;
}

function stringArrayEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (!b.includes(a[i])) return false;
  }
  return true;
}
