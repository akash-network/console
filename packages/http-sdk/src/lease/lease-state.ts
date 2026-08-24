export type LeaseState = "active" | "insufficient_funds" | "closed" | "reclaiming";

export const LIVE_LEASE_STATES = ["active", "reclaiming"] as const satisfies readonly LeaseState[];

/** A lease whose workload is still running — actively leased or in the reclamation grace period. */
export function isLeaseLive(lease: { state: string }): boolean {
  return LIVE_LEASE_STATES.some(state => lease.state === state);
}
