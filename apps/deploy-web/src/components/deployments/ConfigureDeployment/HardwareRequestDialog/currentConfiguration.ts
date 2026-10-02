import type { SdlBuilderFormValuesType } from "@src/types";
import type { GpuVendor } from "@src/types/gpu";
import { roundDecimal } from "@src/utils/mathHelpers";
import { acceptedGpuModelLabels, summarizeGpu } from "../ConfigurationPane/GpuCard/gpuSummary";
import { aggregateDeploymentResources, formatBytes } from "../DeploymentResourceSummary/deploymentResources";
import type { HardwareRequestConfiguration } from "./hardwareRequestForm";
import { MAX_GPU_MODEL_LENGTH, MAX_REGION_LENGTH } from "./hardwareRequestForm";

/** Describes one replica of the service, so the GPU count and the resources agree, and names the replica count separately. */
export function describeCurrentConfiguration(
  values: SdlBuilderFormValuesType,
  serviceIndex: number,
  gpuCatalog: GpuVendor[] | undefined
): HardwareRequestConfiguration {
  const service = values.services[serviceIndex];
  const region = describeRegions(values.placements.find(placement => placement.id === service.placementId)?.regions ?? []);
  const totals = aggregateDeploymentResources([{ ...service, count: 1 }]);
  const storageBytes = totals.ephemeralBytes + totals.persistentBytes;
  const gpuCount = service.profile.hasGpu ? service.profile.gpu ?? 0 : 0;

  const segments = [
    `${roundDecimal(totals.cpu, 2)} vCPU`,
    gpuCount > 0 ? summarizeGpu(service.profile, gpuCatalog) : null,
    `${formatBytes(totals.memoryBytes)} memory`,
    `${formatBytes(storageBytes)} storage`,
    region ?? "Any region",
    service.count > 1 ? `${service.count} replicas` : null
  ];

  return {
    summary: segments.filter(Boolean).join(" · "),
    cpu: totals.cpu,
    memoryBytes: Math.round(totals.memoryBytes),
    storageBytes: Math.round(storageBytes),
    region,
    gpu: gpuCount > 0 ? { count: gpuCount, models: (service.profile.gpuModels ?? []).flatMap(model => (model.name ? [model.name] : [])) } : undefined
  };
}

/** The request keeps the GPU model in one bounded string, so a pick too long to list in full names the first model and counts the rest. */
export function describeRequestedGpuModels(values: SdlBuilderFormValuesType, serviceIndex: number, gpuCatalog: GpuVendor[] | undefined): string {
  const { profile } = values.services[serviceIndex];
  if (!profile.hasGpu || !profile.gpu) return "";

  const labels = acceptedGpuModelLabels(profile.gpuModels ?? [], gpuCatalog);
  const listedModels = labels.join(", ");
  return listedModels.length <= MAX_GPU_MODEL_LENGTH ? listedModels : `${labels[0]} +${labels.length - 1}`;
}

/** The request keeps the region in one bounded string, so a pick too long to list in full names the first region and counts the rest. */
function describeRegions(regions: string[]): string | null {
  if (regions.length === 0) return null;

  const listedRegions = regions.join(", ");
  return listedRegions.length <= MAX_REGION_LENGTH ? listedRegions : `${regions[0]} +${regions.length - 1}`;
}
