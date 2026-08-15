import type { LeaseDto } from "@src/types/deployment";

export const LIVE_LEASE_STATES = ["active", "reclaiming"] as const;

/** A lease whose workload is still running — actively leased or in the reclamation grace period. */
export function isLeaseLive(lease: Pick<LeaseDto, "state">): boolean {
  return LIVE_LEASE_STATES.some(state => lease.state === state);
}

/** Whether any live lease is running on GPU — drives hourly-vs-monthly cost display in the headers. */
export function hasLiveGpuLease(leases: Pick<LeaseDto, "state" | "gpuAmount">[] | null | undefined): boolean {
  return !!leases?.some(lease => isLeaseLive(lease) && !!lease.gpuAmount && lease.gpuAmount > 0);
}
