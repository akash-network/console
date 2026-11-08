import { isLogCollectorService } from "@src/components/sdl/LogCollectorControl/LogCollectorControl";
import type { ServiceType } from "@src/types";
import { roundDecimal } from "@src/utils/mathHelpers";
import { aggregateDeploymentResources, formatBytes } from "../DeploymentResourceSummary/deploymentResources";

export function summarizeTemplateServices(services: ServiceType[]): { names: string[]; serviceCount: string; resources: string } {
  const visibleServices = services.filter(service => !isLogCollectorService(service));
  const totals = aggregateDeploymentResources(visibleServices);
  return {
    names: visibleServices.map(service => service.title),
    serviceCount: countOf(visibleServices.length, "service", "services"),
    resources: `${roundDecimal(totals.cpu, 2)} vCPU · ${formatBytes(totals.memoryBytes)}`
  };
}

export function countOf(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
