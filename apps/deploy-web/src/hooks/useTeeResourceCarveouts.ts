import { useMemo } from "react";

import type { LeaseDto } from "@src/types/deployment";
import type { TeeResourceCarveout } from "@src/utils/confidentialCompute";
import { getTeeResourceCarveouts } from "@src/utils/confidentialCompute";

/**
 * Per-pod attestation-sidecar carve-outs for each resource unit in the lease's on-chain group.
 * TEE type and resources are declared on-chain (group placement requirement + group_spec.resources),
 * so this is sourced from the lease's group rather than the locally stored SDL manifest.
 */
export function useTeeResourceCarveouts(lease: LeaseDto | undefined | null): TeeResourceCarveout[] {
  return useMemo(() => getTeeResourceCarveouts(lease?.group), [lease?.group]);
}
