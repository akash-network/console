import type { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";

import { uint8arrayToString } from "@src/utils/protobuf";

const BYTES_PER_GI = 1024 ** 3;

export interface GroupSpecResourceTotals {
  cpuMillis: number;
  memoryBytes: number;
}

export interface TrialResourceLimits {
  maxCpu: number;
  maxMemoryGi: number;
}

export interface TrialResourceViolation extends GroupSpecResourceTotals {
  kind: "cpu" | "memory";
  message: string;
}

export function sumGroupSpecResources(groups: GroupSpec[] | null | undefined): GroupSpecResourceTotals {
  const totals: GroupSpecResourceTotals = { cpuMillis: 0, memoryBytes: 0 };

  for (const group of groups ?? []) {
    for (const unit of group.resources ?? []) {
      const count = unit.count || 1;
      totals.cpuMillis += resourceValToNumber(unit.resource?.cpu?.units?.val) * count;
      totals.memoryBytes += resourceValToNumber(unit.resource?.memory?.quantity?.val) * count;
    }
  }

  return totals;
}

export function findTrialResourceViolation(groups: GroupSpec[] | null | undefined, limits: TrialResourceLimits): TrialResourceViolation | undefined {
  if (!limits.maxCpu && !limits.maxMemoryGi) return undefined;

  const totals = sumGroupSpecResources(groups);

  if (limits.maxCpu && !(totals.cpuMillis <= limits.maxCpu * 1000)) {
    return {
      ...totals,
      kind: "cpu",
      message: `Free trial deployments are limited to ${limits.maxCpu} CPU. Requested ${totals.cpuMillis / 1000} CPU. Add funds to deploy larger workloads.`
    };
  }

  if (limits.maxMemoryGi && !(totals.memoryBytes <= limits.maxMemoryGi * BYTES_PER_GI)) {
    return {
      ...totals,
      kind: "memory",
      message: `Free trial deployments are limited to ${limits.maxMemoryGi}Gi of memory. Requested ${formatGi(totals.memoryBytes)}Gi. Add funds to deploy larger workloads.`
    };
  }

  return undefined;
}

function formatGi(bytes: number): string {
  return (Math.round((bytes / BYTES_PER_GI) * 100) / 100).toString();
}

/** Resource quantities decode as bigint from chain-sdk types but as Uint8Array on the protobuf wire. */
function resourceValToNumber(val: Uint8Array | bigint | undefined): number {
  if (typeof val === "bigint") return Number(val);
  if (!val || val.length === 0) return 0;
  return parseInt(uint8arrayToString(val), 10);
}
