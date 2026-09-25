import { useServices } from "@src/context/ServicesProvider";
import { catchDeploymentReadError } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import type { LeaseDto, LeaseGpus, LeaseGpusByLease } from "@src/types/deployment";

export const DEPENDENCIES = { useServices };

const EMPTY: LeaseGpusByLease = {};

export function leaseGpuKeyOf(lease: { gseq: number; oseq: number; provider: string }): string {
  return `${lease.gseq}/${lease.oseq}/${lease.provider}`;
}

/**
 * The gpus the console read inside this deployment's leases and the gpus their bids offered. Reads the same query
 * `useDeploymentDefinition` already runs, so the detail page pays for no extra request.
 */
export function useLeaseGpus(dseq: string | undefined | null, dependencies = DEPENDENCIES): { byLease: LeaseGpusByLease; isLoading: boolean } {
  const { api } = dependencies.useServices();

  const query = api.v1.getDeployment.useQuery(
    { dseq: dseq ?? "" },
    {
      enabled: !!dseq,
      /** Shared with `useDeploymentDefinition`, since whichever of the two fetches first decides how this query's errors resolve for both. */
      catchError: catchDeploymentReadError,
      select: selectLeaseGpusByLease
    }
  );

  return { byLease: query.data ?? EMPTY, isLoading: query.isLoading };
}

type LeaseWithGpus = LeaseGpus & { id: { gseq: number; oseq: number; provider: string } };

/** Module-level and plain objects, so react-query hands back the same readings until one of them changes: anything else re-keys every lease view below it. */
function selectLeaseGpusByLease(response: { data?: { leases?: readonly LeaseWithGpus[] } } | null): LeaseGpusByLease {
  const byLease: LeaseGpusByLease = {};

  for (const lease of response?.data?.leases ?? []) {
    const leaseGpus = recordedGpusOf(lease);
    if (leaseGpus) byLease[leaseGpuKeyOf(lease.id)] = leaseGpus;
  }

  return byLease;
}

/** Leaves out whichever of the two was never recorded, so joining it onto a lease cannot blank a field the lease already holds. */
function recordedGpusOf({ detectedGpus, offeredGpus }: LeaseWithGpus): LeaseGpus | undefined {
  const leaseGpus: LeaseGpus = {};
  if (detectedGpus) leaseGpus.detectedGpus = detectedGpus;
  if (offeredGpus) leaseGpus.offeredGpus = offeredGpus;

  return Object.keys(leaseGpus).length ? leaseGpus : undefined;
}

/** Joins what the console recorded onto the chain's leases, which carry no hardware of their own. */
export function withLeaseGpus<T extends LeaseDto[] | null | undefined>(leases: T, byLease: LeaseGpusByLease): T {
  if (!leases?.length || !Object.keys(byLease).length) return leases;

  return leases.map(lease => {
    const leaseGpus = byLease[leaseGpuKeyOf(lease)];

    return leaseGpus ? { ...lease, ...leaseGpus } : lease;
  }) as T;
}
