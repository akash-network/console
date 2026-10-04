import { aggregateDeploymentResources, formatBytes } from "@src/components/deployments/ConfigureDeployment/DeploymentResourceSummary/deploymentResources";
import type { ProfileGpuModelType, ServiceType } from "@src/types";
import { roundDecimal } from "@src/utils/mathHelpers";
import { importSimpleSdl } from "@src/utils/sdl/sdlImport";

export interface TemplateDeploymentSummary {
  serviceCount: number;
  /** Set for a single-service template only, since several services run several images. */
  image?: string;
  gpu?: string;
  cpu: string;
  memory: string;
  storage: string;
  persistentStorage?: string;
}

/** What Configure fills in for this template's SDL, totalled across services and replicas; undefined when Configure could not import it either. */
export function summarizeTemplateDeployment(sdl: string | undefined): TemplateDeploymentSummary | undefined {
  const services = importServices(sdl);
  if (!services?.length) return undefined;

  const totals = aggregateDeploymentResources(services);

  return {
    serviceCount: services.length,
    image: services.length === 1 ? services[0].image : undefined,
    gpu: describeGpus(services),
    cpu: String(roundDecimal(totals.cpu, 2)),
    memory: formatBytes(totals.memoryBytes),
    storage: formatBytes(totals.ephemeralBytes),
    persistentStorage: totals.persistentBytes > 0 ? formatBytes(totals.persistentBytes) : undefined
  };
}

function importServices(sdl: string | undefined): ServiceType[] | undefined {
  if (!sdl) return undefined;

  try {
    return importSimpleSdl(sdl).services;
  } catch {
    return undefined;
  }
}

/** Counts GPUs per set of models a service accepts, so one service's count is never shown against another service's models. */
function describeGpus(services: ServiceType[]): string | undefined {
  const gpusByModelSet = new Map<string, { models: string; units: number }>();

  for (const service of services) {
    const units = service.profile.hasGpu ? (service.profile.gpu || 0) * (service.count || 0) : 0;
    if (units > 0) {
      const names = listGpuModelNames(service.profile.gpuModels ?? []);
      const modelSet = [...names].sort((a, b) => a.localeCompare(b)).join();
      const counted = gpusByModelSet.get(modelSet) ?? { models: names.length > 0 ? names.join(" / ") : "Any", units: 0 };
      gpusByModelSet.set(modelSet, { ...counted, units: counted.units + units });
    }
  }

  if (gpusByModelSet.size === 0) return undefined;
  return Array.from(gpusByModelSet.values(), ({ models, units }) => `${units}\u00d7 ${models}`).join(", ");
}

/** Named models when the SDL pins any, else the vendor it accepts any model from. */
function listGpuModelNames(models: ProfileGpuModelType[]): string[] {
  return Array.from(new Set(models.map(model => (model.name || model.vendor).toUpperCase())));
}
