import type { ServiceType } from "@src/types";
import { roundDecimal } from "@src/utils/mathHelpers";
import { aggregateDeploymentResources } from "../../../DeploymentResourceSummary/deploymentResources";

const BYTES_PER_GI = 1024 ** 3;

/** A zero cap is switched off, as it is on the api. */
export type TrialResourceLimit = { maxCpu: number; maxMemoryGi: number };

export type DeploymentSize = { cpu: number; memoryGi: number };

/** Totals every service and replica, the way the api sums a trial deployment before refusing one over the limit. */
export function measureDeploymentSize(services: ServiceType[]): DeploymentSize {
  const totals = aggregateDeploymentResources(services);
  return { cpu: roundDecimal(totals.cpu, 3), memoryGi: totals.memoryBytes / BYTES_PER_GI };
}

export function exceedsTrialResourceLimit(size: DeploymentSize, limit: TrialResourceLimit): boolean {
  const exceedsCpu = limit.maxCpu > 0 && size.cpu > limit.maxCpu;
  const exceedsMemory = limit.maxMemoryGi > 0 && size.memoryGi > limit.maxMemoryGi;
  return exceedsCpu || exceedsMemory;
}

export function describeTrialResourceLimit(limit: TrialResourceLimit): string {
  const caps = [];
  if (limit.maxCpu > 0) caps.push(`${limit.maxCpu} vCPU`);
  if (limit.maxMemoryGi > 0) caps.push(`${limit.maxMemoryGi} GiB of memory`);
  return caps.join(" and ");
}

export function describeDeploymentSize(size: DeploymentSize): string {
  return `${roundDecimal(size.cpu)} vCPU and ${roundDecimal(size.memoryGi)} GiB of memory`;
}
