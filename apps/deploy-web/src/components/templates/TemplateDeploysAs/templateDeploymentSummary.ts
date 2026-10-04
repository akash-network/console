import { aggregateDeploymentResources, formatBytes } from "@src/components/deployments/ConfigureDeployment/DeploymentResourceSummary/deploymentResources";
import type { ServiceType } from "@src/types";
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
    gpu: totals.gpu > 0 ? `${totals.gpu}× ${describeGpuModels(services)}` : undefined,
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

/** Named models when the SDL pins any, else the vendor it accepts any model from. */
function describeGpuModels(services: ServiceType[]): string {
  const models = services.flatMap(service => service.profile.gpuModels ?? []);
  const names = Array.from(new Set(models.map(model => (model.name || model.vendor).toUpperCase())));

  return names.length > 0 ? names.join(" / ") : "Any";
}
