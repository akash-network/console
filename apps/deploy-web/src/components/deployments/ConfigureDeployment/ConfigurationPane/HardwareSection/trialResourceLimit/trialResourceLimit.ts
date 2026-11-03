import type { ServiceType } from "@src/types";
import { memoryUnits } from "@src/utils/akash/units";
import { roundDecimal } from "@src/utils/mathHelpers";
import { aggregateDeploymentResources } from "../../../DeploymentResourceSummary/deploymentResources";

const BYTES_PER_GI = 1024 ** 3;

const BYTES_PER_MI = 1024 ** 2;

const MI_PER_GI = 1024;

const MIN_CPU = 0.1;

const MIN_MEMORY_MI = 1;

const CPU_STEPS_PER_VCPU = 10;

/** Scaled sizes are rounded to this many decimals before flooring, so floating point noise never drops a size that lands on a step a whole step lower. */
const SCALING_PRECISION = 3;

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

/** Scales every service down by the same share so the deployment keeps its proportions; undefined when the minimum sizes still exceed the limit. */
export function fitServicesToTrialResourceLimit(services: ServiceType[], limit: TrialResourceLimit): ServiceType[] | undefined {
  const size = measureDeploymentSize(services);
  const cpuShare = limit.maxCpu > 0 && size.cpu > limit.maxCpu ? limit.maxCpu / size.cpu : 1;
  const memoryShare = limit.maxMemoryGi > 0 && size.memoryGi > limit.maxMemoryGi ? limit.maxMemoryGi / size.memoryGi : 1;

  const fittedServices = services.map(service => ({
    ...service,
    profile: { ...service.profile, cpu: scaleCpu(service.profile.cpu, cpuShare), ...scaleMemory(service.profile, memoryShare) }
  }));

  return exceedsTrialResourceLimit(measureDeploymentSize(fittedServices), limit) ? undefined : fittedServices;
}

function scaleCpu(cpu: number, share: number): number {
  if (share === 1) return cpu;
  return Math.max(MIN_CPU, Math.floor(roundDecimal(cpu * share * CPU_STEPS_PER_VCPU, SCALING_PRECISION)) / CPU_STEPS_PER_VCPU);
}

function scaleMemory({ ram, ramUnit }: ServiceType["profile"], share: number): Pick<ServiceType["profile"], "ram" | "ramUnit"> {
  if (share === 1) return { ram, ramUnit };
  const unitBytes = memoryUnits.find(unit => unit.suffix.toLowerCase() === ramUnit.toLowerCase())?.value ?? 0;
  const mebibytes = Math.max(MIN_MEMORY_MI, Math.floor(roundDecimal((ram * unitBytes * share) / BYTES_PER_MI, SCALING_PRECISION)));
  return mebibytes % MI_PER_GI === 0 ? { ram: mebibytes / MI_PER_GI, ramUnit: "Gi" } : { ram: mebibytes, ramUnit: "Mi" };
}
