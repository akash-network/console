import { isLeaseLive } from "@akashnetwork/http-sdk";

import type { LeaseDto } from "@src/types/deployment";

export { isLeaseLive, LIVE_LEASE_STATES } from "@akashnetwork/http-sdk";

/** Whether any live lease is running on GPU — drives hourly-vs-monthly cost display in the headers. */
export function hasLiveGpuLease(leases: Pick<LeaseDto, "state" | "gpuAmount">[] | null | undefined): boolean {
  return !!leases?.some(lease => isLeaseLive(lease) && !!lease.gpuAmount && lease.gpuAmount > 0);
}
