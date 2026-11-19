export type DescribableGpuSetup = { model: string; gpuCount: number; memory?: string | null; interface?: string | null };

export function describeGpuSetup(setup: DescribableGpuSetup): string {
  return [`${setup.gpuCount}×`, setup.model.toUpperCase(), setup.memory, setup.interface?.toUpperCase()].filter(Boolean).join(" ");
}
