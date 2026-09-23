import { ApiError } from "@akashnetwork/openapi-sdk";

import { useServices } from "@src/context/ServicesProvider";
import type { DetectedGpusByLease, DetectedLeaseGpus, LeaseDto } from "@src/types/deployment";

export const DEPENDENCIES = { useServices };

const EMPTY: DetectedGpusByLease = new Map();

export function leaseGpuKeyOf(lease: { gseq: number; oseq: number; provider: string }): string {
  return `${lease.gseq}/${lease.oseq}/${lease.provider}`;
}

/**
 * The gpus the console read inside this deployment's leases. Reads the same query `useDeploymentDefinition` already
 * runs, so the detail page pays for no extra request.
 */
export function useDetectedLeaseGpus(dseq: string | undefined | null, dependencies = DEPENDENCIES): DetectedGpusByLease {
  const { api } = dependencies.useServices();

  const query = api.v1.getDeployment.useQuery(
    { dseq: dseq ?? "" },
    {
      enabled: !!dseq,
      /** Kept identical to `useDeploymentDefinition`'s, so the two provably share one query rather than racing two. */
      catchError(error) {
        if (error instanceof ApiError && error.status >= 500) throw error;
        return null;
      },
      select: selectDetectedGpusByLease
    }
  );

  return query.data ?? EMPTY;
}

type LeaseWithDetectedGpus = { id: { gseq: number; oseq: number; provider: string }; detectedGpus?: DetectedLeaseGpus };

/** Module-level so react-query keeps the map it built until the deployment changes: a fresh one per render would re-key every lease view below it. */
function selectDetectedGpusByLease(response: { data?: { leases?: readonly LeaseWithDetectedGpus[] } } | null): DetectedGpusByLease {
  const byLease: DetectedGpusByLease = new Map();

  for (const lease of response?.data?.leases ?? []) {
    if (lease.detectedGpus) byLease.set(leaseGpuKeyOf(lease.id), lease.detectedGpus);
  }

  return byLease;
}

/** Joins what the console read onto the chain's leases, which carry no hardware of their own. */
export function withDetectedGpus<T extends LeaseDto[] | null | undefined>(leases: T, byLease: DetectedGpusByLease): T {
  if (!leases?.length || !byLease.size) return leases;

  return leases.map(lease => {
    const detectedGpus = byLease.get(leaseGpuKeyOf(lease));

    return detectedGpus ? { ...lease, detectedGpus } : lease;
  }) as T;
}
