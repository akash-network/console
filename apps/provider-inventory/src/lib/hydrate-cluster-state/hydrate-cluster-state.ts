import { ResourcePair } from "@src/lib/resource-pair/resource-pair";
import type { ClusterState, NodeState } from "@src/types/inventory.types";

type RawPair = { allocatable: number | bigint; allocated: number | bigint };
type RawNode = Omit<NodeState, "cpu" | "memory" | "ephemeralStorage" | "gpu"> & {
  cpu: RawPair;
  memory: RawPair;
  ephemeralStorage: RawPair;
  gpu: { quantity: RawPair; info: NodeState["gpu"]["info"] };
};
type RawCluster = {
  nodes?: RawNode[];
  storage?: Record<string, { class: string; quantity: RawPair }>;
};

export function hydrateClusterState(raw: unknown): ClusterState {
  const cluster = (raw ?? {}) as RawCluster;
  const nodes = (cluster.nodes ?? []).map(hydrateNode);
  const storage: ClusterState["storage"] = Object.create(null);
  for (const [key, pool] of Object.entries(cluster.storage ?? {})) {
    storage[key] = { class: pool.class, quantity: hydratePair(pool.quantity) };
  }
  return { nodes, storage };
}

function hydrateNode(node: RawNode): NodeState {
  return {
    name: node.name,
    cpu: hydratePair(node.cpu),
    memory: hydratePair(node.memory),
    ephemeralStorage: hydratePair(node.ephemeralStorage),
    gpu: { quantity: hydratePair(node.gpu.quantity), info: node.gpu.info ?? [] },
    storageClasses: node.storageClasses ?? [],
    cpus: node.cpus ?? []
  };
}

function hydratePair(pair: RawPair): ResourcePair {
  const allocatable = typeof pair.allocatable === "bigint" ? pair.allocatable : BigInt(pair.allocatable || 0);
  const allocated = typeof pair.allocated === "bigint" ? pair.allocated : BigInt(pair.allocated || 0);

  return new ResourcePair(allocatable, allocated);
}
