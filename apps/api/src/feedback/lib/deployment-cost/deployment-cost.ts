import type { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";

import { resourceValToNumber } from "@src/deployment/utils/group-resources/group-resources";
import { round } from "@src/utils/math";

export interface ResourceSpec {
  cpuMillis: number;
  memoryBytes: number;
  storageBytes: number;
}

export interface DeploymentCost {
  estimatedUsdPerMonth: number | null;
}

type ResourceUnit = GroupSpec["resources"][number];

function specOf({ resource }: ResourceUnit): ResourceSpec {
  return {
    cpuMillis: resourceValToNumber(resource?.cpu?.units?.val),
    memoryBytes: resourceValToNumber(resource?.memory?.quantity?.val),
    storageBytes: (resource?.storage ?? []).reduce((total, { quantity }) => total + resourceValToNumber(quantity?.val), 0)
  };
}

function requestsGpu({ resource }: ResourceUnit): boolean {
  return resourceValToNumber(resource?.gpu?.units?.val) > 0;
}

/** GPU prices move with the market, so a GPU deployment gets no estimate. */
export function deploymentCostOf(groups: GroupSpec[], typicalUsdPerMonthOf: (spec: ResourceSpec) => number): DeploymentCost {
  const units = groups.flatMap(({ resources }) => resources);

  if (units.some(requestsGpu)) return { estimatedUsdPerMonth: null };

  return {
    estimatedUsdPerMonth: round(
      units.reduce((total, unit) => total + typicalUsdPerMonthOf(specOf(unit)) * unit.count, 0),
      2
    )
  };
}
