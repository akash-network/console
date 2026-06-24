import { useMemo } from "react";

import type { DeploymentDto } from "@src/types/deployment";
import type { TeeType } from "@src/utils/confidentialCompute";
import { getDeclaredTeeTypes } from "@src/utils/confidentialCompute";

/** Distinct Confidential Compute TEE types declared on the deployment's on-chain groups. */
export function useDeclaredTeeTypes(deployment: DeploymentDto | undefined | null): TeeType[] {
  return useMemo(() => getDeclaredTeeTypes(deployment?.groups), [deployment?.groups]);
}
