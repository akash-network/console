import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import { isLeaseLive } from "@src/utils/leaseUtils";

/**
 * Whether the deployment has stopped running. Only true once the leases are known: an in-flight lease
 * query is not evidence it stopped, and treating it as such would flash stopped-state UI on every load.
 */
export function useHasDeploymentStopped({
  deployment,
  leases
}: {
  deployment: Pick<DeploymentDto, "state">;
  leases: Pick<LeaseDto, "state">[] | null | undefined;
}): boolean {
  return deployment.state === "closed" || (!!leases && !leases.some(isLeaseLive));
}
