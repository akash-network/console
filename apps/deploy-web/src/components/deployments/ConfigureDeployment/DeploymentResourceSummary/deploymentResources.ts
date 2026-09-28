import type { ServiceType } from "@src/types";
import { memoryUnits, storageUnits } from "@src/utils/akash/units";
import { roundDecimal } from "@src/utils/mathHelpers";
import { bytesToShrink } from "@src/utils/unitUtils";

export interface DeploymentResourceTotals {
  cpu: number;
  gpu: number;
  memoryBytes: number;
  ephemeralBytes: number;
  persistentBytes: number;
}

/** Converts a sized resource entry to bytes using the matching unit multiplier; an unknown unit contributes 0. */
function toBytes(size: number, unit: string, units: ReadonlyArray<{ suffix: string; value: number }>): number {
  const match = units.find(candidate => candidate.suffix.toLowerCase() === unit?.toLowerCase());
  return (size || 0) * (match?.value ?? 0);
}

/** Sums per-replica resources (× count) across every service into a single totals object, in bytes. */
export function aggregateDeploymentResources(services: ServiceType[]): DeploymentResourceTotals {
  return services.reduce<DeploymentResourceTotals>(
    (totals, service) => {
      const count = service.count || 0;
      const { profile } = service;

      totals.cpu += (profile.cpu || 0) * count;
      if (profile.hasGpu) {
        totals.gpu += (profile.gpu || 0) * count;
      }
      totals.memoryBytes += toBytes(profile.ram, profile.ramUnit, memoryUnits) * count;

      for (const storage of profile.storage) {
        const bytes = toBytes(storage.size, storage.unit, storageUnits) * count;
        if (storage.isPersistent) {
          totals.persistentBytes += bytes;
        } else {
          totals.ephemeralBytes += bytes;
        }
      }

      return totals;
    },
    { cpu: 0, gpu: 0, memoryBytes: 0, ephemeralBytes: 0, persistentBytes: 0 }
  );
}

export type DeploymentResourceKind = "cpu" | "gpu" | "memory" | "storage" | "persistent";

export interface DeploymentResourceSegment {
  kind: DeploymentResourceKind;
  label: string;
}

function formatBytes(bytes: number): string {
  const { value, unit } = bytesToShrink(bytes, true);
  return `${roundDecimal(value, 2)} ${unit}`;
}

/** The header summary as labelled segments; GPU and persistent storage appear only when requested, and an empty spec has none. */
export function deploymentResourceSegments(totals: DeploymentResourceTotals): DeploymentResourceSegment[] {
  const hasResources = totals.cpu > 0 || totals.gpu > 0 || totals.memoryBytes > 0 || totals.ephemeralBytes > 0 || totals.persistentBytes > 0;
  if (!hasResources) {
    return [];
  }

  const segments: DeploymentResourceSegment[] = [{ kind: "cpu", label: `${roundDecimal(totals.cpu, 2)} vCPU` }];
  if (totals.gpu > 0) {
    segments.push({ kind: "gpu", label: `${totals.gpu} GPU` });
  }
  segments.push({ kind: "memory", label: formatBytes(totals.memoryBytes) });
  segments.push({ kind: "storage", label: formatBytes(totals.ephemeralBytes) });
  if (totals.persistentBytes > 0) {
    segments.push({ kind: "persistent", label: `${formatBytes(totals.persistentBytes)} persistent` });
  }

  return segments;
}
