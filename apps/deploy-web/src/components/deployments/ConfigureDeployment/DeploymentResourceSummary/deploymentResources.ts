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

/** Formats a byte total to a binary unit string with no separating space, e.g. `512MiB`. */
function formatBytes(bytes: number): string {
  const { value, unit } = bytesToShrink(bytes, true);
  return `${roundDecimal(value, 2)}${unit}`;
}

/**
 * Builds the header summary string: `{cpu} vCPU · [{gpu} GPU ·] {memory} · {ephemeral} [· {persistent} persistent]`.
 * GPU and persistent segments appear only when present. Returns an em dash when the spec has no resources.
 */
export function formatDeploymentResources(totals: DeploymentResourceTotals): string {
  const hasResources = totals.cpu > 0 || totals.gpu > 0 || totals.memoryBytes > 0 || totals.ephemeralBytes > 0 || totals.persistentBytes > 0;
  if (!hasResources) {
    return "—";
  }

  const segments = [`${roundDecimal(totals.cpu, 2)} vCPU`];
  if (totals.gpu > 0) {
    segments.push(`${totals.gpu} GPU`);
  }
  segments.push(formatBytes(totals.memoryBytes));
  segments.push(formatBytes(totals.ephemeralBytes));
  if (totals.persistentBytes > 0) {
    segments.push(`${formatBytes(totals.persistentBytes)} persistent`);
  }

  return segments.join(" · ");
}
