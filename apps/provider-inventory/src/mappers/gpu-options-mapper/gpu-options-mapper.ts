import type { PlacementOptionsResponse } from "@src/http-schemas/placement-options.schema";
import { normalizeGPUInterface } from "@src/mappers/gpu-attribute-parser/gpu-attribute-parser";
import type { AvailableGpu } from "@src/repositories/placement-options/placement-options.repository";

type GpuVendorOption = PlacementOptionsResponse["gpus"][number];
type GpuModelOption = GpuVendorOption["models"][number];

interface GpuShape {
  memory: string | null;
  interface: string | null;
}

interface NodeCapacity {
  matchingUnits: number;
  nodeFreeUnits: number | null;
}

interface CountedShape extends GpuShape {
  owners: Set<string>;
  nodes: Map<string, NodeCapacity>;
}

/** The only GPU interfaces an SDL can carry. */
const SDL_INTERFACES = new Set(["pcie", "sxm"]);

/** A provider bids on a picked GPU only when it advertises the exact key the SDL builds from the pick, so every memory and interface combination is counted on its own. */
export function mapToGpuVendorOptions(gpus: AvailableGpu[]): GpuVendorOption[] {
  const vendors = new Map<string, Map<string, Map<string, CountedShape>>>();

  for (const gpu of gpus) {
    for (const shape of findBiddableShapes(gpu)) {
      const models = getOrCreate(vendors, gpu.vendor, () => new Map<string, Map<string, CountedShape>>());
      const shapes = getOrCreate(models, gpu.model, () => new Map<string, CountedShape>());
      const counted = getOrCreate(shapes, `${shape.memory}|${shape.interface}`, () => ({
        ...shape,
        owners: new Set<string>(),
        nodes: new Map<string, NodeCapacity>()
      }));
      counted.owners.add(gpu.owner);
      getOrCreate(counted.nodes, `${gpu.owner}|${gpu.node}`, () => ({ matchingUnits: 0, nodeFreeUnits: gpu.nodeFreeUnits })).matchingUnits += gpu.units;
    }
  }

  return [...vendors]
    .map(([vendor, models]) => ({
      vendor,
      models: [...models].flatMap(([name, shapes]) => toModelOption(name, [...shapes.values()]))
    }))
    .filter(vendor => vendor.models.length > 0);
}

function findBiddableShapes(gpu: AvailableGpu): GpuShape[] {
  const advertised = new Set(gpu.advertisedGpuKeys);
  const memory = gpu.memory || null;
  const normalizedInterface = gpu.interface ? normalizeGPUInterface(gpu.interface) : "";
  const sdlInterface = SDL_INTERFACES.has(normalizedInterface) ? normalizedInterface : null;

  const shapes: GpuShape[] = [{ memory: null, interface: null }];
  if (memory) shapes.push({ memory, interface: null });
  if (sdlInterface) shapes.push({ memory: null, interface: sdlInterface });
  if (memory && sdlInterface) shapes.push({ memory, interface: sdlInterface });

  return shapes.filter(shape => advertised.has(toSdlGpuKey(gpu, shape)));
}

/** Mirrors the chain SDK, which always writes the memory before the interface. */
function toSdlGpuKey(gpu: AvailableGpu, shape: GpuShape): string {
  const memory = shape.memory ? `/ram/${shape.memory}` : "";
  const gpuInterface = shape.interface ? `/interface/${shape.interface}` : "";
  return `vendor/${gpu.vendor}/model/${gpu.model}${memory}${gpuInterface}`;
}

function toModelOption(name: string, shapes: CountedShape[]): GpuModelOption[] {
  const modelOnly = shapes.find(shape => shape.memory === null && shape.interface === null);
  if (!modelOnly) return [];

  return [
    {
      name,
      memory: shapes.flatMap(shape => (shape.memory !== null && shape.interface === null ? [shape.memory] : [])),
      interface: shapes.flatMap(shape => (shape.memory === null && shape.interface !== null ? [shape.interface] : [])),
      providerCount: modelOnly.owners.size,
      ...countFreeUnits(modelOnly),
      variants: shapes.map(shape => ({ memory: shape.memory, interface: shape.interface, providerCount: shape.owners.size, ...countFreeUnits(shape) }))
    }
  ];
}

function countFreeUnits(shape: CountedShape): { availableUnits: number; maxNodeFreeUnits: number } {
  const biddableUnitsPerNode = [...shape.nodes.values()].map(countBiddableUnits);
  return {
    availableUnits: biddableUnitsPerNode.reduce((sum, units) => sum + units, 0),
    maxNodeFreeUnits: Math.max(...biddableUnitsPerNode)
  };
}

/** A provider bids when the node has that many GPUs free and lists that many matching devices, free or not, so a node never offers more of a shape than both allow. */
function countBiddableUnits({ matchingUnits, nodeFreeUnits }: NodeCapacity): number {
  return nodeFreeUnits === null ? matchingUnits : Math.min(matchingUnits, nodeFreeUnits);
}

function getOrCreate<K, V>(map: Map<K, V>, key: K, create: () => V): V {
  let value = map.get(key);
  if (value === undefined) {
    value = create();
    map.set(key, value);
  }
  return value;
}
