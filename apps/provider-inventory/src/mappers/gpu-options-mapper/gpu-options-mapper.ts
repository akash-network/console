import type { PlacementOptionsResponse } from "@src/http-schemas/placement-options.schema";
import { normalizeGPUInterface } from "@src/mappers/gpu-attribute-parser/gpu-attribute-parser";
import type { AvailableGpu } from "@src/repositories/placement-options/placement-options.repository";

type GpuVendorOption = PlacementOptionsResponse["gpus"][number];

interface ModelValues {
  memory: Set<string>;
  interface: Set<string>;
  owners: Set<string>;
}

/** Memory and interface are collected per model rather than as pairs, so the wider set never hides a GPU somebody could lease. */
export function mapToGpuVendorOptions(gpus: AvailableGpu[]): GpuVendorOption[] {
  const vendors = new Map<string, Map<string, ModelValues>>();

  for (const gpu of gpus) {
    let models = vendors.get(gpu.vendor);
    if (!models) {
      models = new Map();
      vendors.set(gpu.vendor, models);
    }

    let values = models.get(gpu.model);
    if (!values) {
      values = { memory: new Set(), interface: new Set(), owners: new Set() };
      models.set(gpu.model, values);
    }

    if (gpu.memory) values.memory.add(gpu.memory);
    if (gpu.interface) values.interface.add(normalizeGPUInterface(gpu.interface));
    values.owners.add(gpu.owner);
  }

  return [...vendors].map(([vendor, models]) => ({
    vendor,
    models: [...models].map(([name, values]) => ({
      name,
      memory: [...values.memory],
      interface: [...values.interface],
      providerCount: values.owners.size
    }))
  }));
}
