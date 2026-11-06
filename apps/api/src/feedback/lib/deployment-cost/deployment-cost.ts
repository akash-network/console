import type { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";

import { resourceValToNumber } from "@src/deployment/utils/group-resources/group-resources";
import { averageBlockCountInAMonth } from "@src/utils/constants";
import { round } from "@src/utils/math";

/** ACT is pegged 1:1 to the US dollar, so only uact prices convert to dollars without a market rate. */
const UACT_PER_USD = 1_000_000;

export interface ResourceSpec {
  cpuMillis: number;
  memoryBytes: number;
  storageBytes: number;
}

export interface DeploymentCost {
  estimatedUsdPerMonth: number | null;
  maxUsdPerMonth: number | null;
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

/** Rounded up to the cent, so the cap shown is never under what the SDL allows. */
function maxUsdPerMonthOf(units: ResourceUnit[]): number | null {
  if (!units.every(({ price }) => price?.denom === "uact")) return null;

  const uactPerBlock = units.reduce((total, { price, count }) => total + Number(price!.amount) * count, 0);
  return Math.ceil((uactPerBlock * averageBlockCountInAMonth * 100) / UACT_PER_USD) / 100;
}

function estimatedUsdPerMonthOf(units: ResourceUnit[], typicalUsdPerMonthOf: (spec: ResourceSpec) => number): number | null {
  if (units.some(requestsGpu)) return null;

  return round(
    units.reduce((total, unit) => total + typicalUsdPerMonthOf(specOf(unit)) * unit.count, 0),
    2
  );
}

/** GPU prices move with the market, so a GPU deployment gets no estimate, only its price cap. */
export function deploymentCostOf(groups: GroupSpec[], typicalUsdPerMonthOf: (spec: ResourceSpec) => number): DeploymentCost {
  const units = groups.flatMap(({ resources }) => resources);

  return { estimatedUsdPerMonth: estimatedUsdPerMonthOf(units, typicalUsdPerMonthOf), maxUsdPerMonth: maxUsdPerMonthOf(units) };
}
