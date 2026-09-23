import { useServices } from "@src/context/ServicesProvider";
import { catchDeploymentReadError } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import type { DetectedGpusByLease, DetectedLeaseGpus, LeaseDto } from "@src/types/deployment";

export const DEPENDENCIES = { useServices };

const EMPTY: DetectedGpusByLease = {};

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
      /** Shared with `useDeploymentDefinition`, since whichever of the two fetches first decides how this query's errors resolve for both. */
      catchError: catchDeploymentReadError,
      select: selectDetectedGpusByLease
    }
  );

  return query.data ?? EMPTY;
}

type LeaseWithDetectedGpus = { id: { gseq: number; oseq: number; provider: string }; detectedGpus?: DetectedLeaseGpus };

/** Module-level and a plain object, so react-query hands back the same readings until one of them changes: anything else re-keys every lease view below it. */
function selectDetectedGpusByLease(response: { data?: { leases?: readonly LeaseWithDetectedGpus[] } } | null): DetectedGpusByLease {
  const byLease: DetectedGpusByLease = {};

  for (const lease of response?.data?.leases ?? []) {
    if (lease.detectedGpus) byLease[leaseGpuKeyOf(lease.id)] = lease.detectedGpus;
  }

  return byLease;
}

/** Joins what the console read onto the chain's leases, which carry no hardware of their own. */
export function withDetectedGpus<T extends LeaseDto[] | null | undefined>(leases: T, byLease: DetectedGpusByLease): T {
  if (!leases?.length || !Object.keys(byLease).length) return leases;

  return leases.map(lease => {
    const detectedGpus = byLease[leaseGpuKeyOf(lease)];

    return detectedGpus ? { ...lease, detectedGpus } : lease;
  }) as T;
}
