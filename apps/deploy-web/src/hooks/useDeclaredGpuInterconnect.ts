import { useMemo } from "react";

import type { DeploymentDto } from "@src/types/deployment";
import type { DeclaredGpuInterconnect } from "@src/utils/gpuInterconnect";
import { getDeclaredGpuInterconnect } from "@src/utils/gpuInterconnect";

/** GPU interconnect opt-in (and any pinned fabrics) declared on the deployment's on-chain groups. */
export function useDeclaredGpuInterconnect(deployment: DeploymentDto | undefined | null): DeclaredGpuInterconnect {
  return useMemo(() => getDeclaredGpuInterconnect(deployment?.groups), [deployment?.groups]);
}
