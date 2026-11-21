import type { GpuSupplyRow } from "@src/gpu-waitlist/services/gpu-supply-http/gpu-supply-http.service";

export type PoolSupply = { freeUnits: number; nodeFreeUnits: number[]; providers: string[] };

export type PoolKind = { memory?: string | null; interface?: string | null };

const GPU_SETUP_INTERFACES = ["pcie", "sxm"] as const;

export function toGpuSetupInterface(gpuInterface: string | null | undefined): (typeof GPU_SETUP_INTERFACES)[number] | undefined {
  const lowered = gpuInterface?.toLowerCase() ?? "";

  return GPU_SETUP_INTERFACES.find(family => lowered.startsWith(family));
}

export function summarizePoolSupply(rows: GpuSupplyRow[], bidders: Set<string>, pool: PoolKind): PoolSupply {
  const unitsByNode = new Map<string, { owner: string; units: number; nodeFreeUnits: number }>();

  for (const row of rows.filter(row => bidders.has(row.owner) && isOfKind(row, pool))) {
    const nodeKey = `${row.owner}/${row.node}`;
    const node = unitsByNode.get(nodeKey) ?? { owner: row.owner, units: 0, nodeFreeUnits: row.nodeFreeUnits ?? Number.MAX_SAFE_INTEGER };
    unitsByNode.set(nodeKey, { ...node, units: Math.min(node.units + row.units, Number.MAX_SAFE_INTEGER) });
  }

  const freeNodes = [...unitsByNode.values()]
    .map(node => ({ owner: node.owner, free: Math.min(node.units, node.nodeFreeUnits) }))
    .filter(node => node.free > 0);

  return {
    freeUnits: freeNodes.reduce((total, node) => Math.min(total + node.free, Number.MAX_SAFE_INTEGER), 0),
    nodeFreeUnits: freeNodes.map(node => node.free),
    providers: [...new Set(freeNodes.map(node => node.owner))]
  };
}

function isOfKind(row: GpuSupplyRow, pool: PoolKind): boolean {
  return (
    (!pool.memory || row.memory.toLowerCase() === pool.memory.toLowerCase()) &&
    (!pool.interface || interfaceFamily(row.interface) === interfaceFamily(pool.interface))
  );
}

function interfaceFamily(gpuInterface: string): string {
  return toGpuSetupInterface(gpuInterface) ?? gpuInterface.toLowerCase();
}
