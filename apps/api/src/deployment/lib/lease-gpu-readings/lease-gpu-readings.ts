import type { LeaseGpuReading } from "@src/deployment/model-schemas";

function leaseServiceKeyOf({ gseq, oseq, provider, service }: LeaseGpuReading): string {
  return `${gseq}/${oseq}/${provider}/${service}`;
}

/** A re-probe replaces what the last one saw rather than appending, so a card swapped under a rescheduled pod cannot read as a second card. */
export function mergeLeaseGpuReadings(current: LeaseGpuReading[], incoming: LeaseGpuReading[]): LeaseGpuReading[] {
  const replaced = new Set(incoming.map(leaseServiceKeyOf));

  return [...current.filter(reading => !replaced.has(leaseServiceKeyOf(reading))), ...incoming];
}
