import { useQueries } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { catchDeploymentReadError } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import { isLeaseLive } from "@src/utils/leaseUtils";

/** `stopped` is a deployment that closed before it was ready, which will never be. */
export type DeploymentReadiness = "starting" | "ready" | "stopped";

export interface DeploymentLaunch {
  dseq: string;
  name: string | null;
  /** Undefined until the deployment and what each of its providers reports have been read. */
  readiness: DeploymentReadiness | undefined;
}

export interface DeploymentState {
  deployment: { state: string };
  leases: Array<{ state: string; status: { services: Record<string, { available: number }> } | null }>;
}

export const DEPENDENCIES = { useServices };

const READINESS_POLL_MS = 10_000;

/** Whether each deployment has a ready replica of every service yet, read from the console api, which asks the providers. */
export function useDeploymentsReadiness(dseqs: string[], dependencies: typeof DEPENDENCIES = DEPENDENCIES): DeploymentLaunch[] {
  const { api } = dependencies.useServices();

  return useQueries({
    queries: dseqs.map(dseq => ({
      ...api.v1.getDeployment.queryOptions({ dseq }, { catchError: catchDeploymentReadError }),
      refetchInterval: READINESS_POLL_MS
    })),
    combine: results => results.map(({ data }, index) => ({ dseq: dseqs[index], name: data?.data.name ?? null, readiness: readinessOf(data?.data) }))
  });
}

/** A lease whose provider has not reported yet leaves the deployment undecided, never starting, since it may well be running. */
export function readinessOf(state: DeploymentState | undefined): DeploymentReadiness | undefined {
  if (!state) return undefined;

  const { deployment, leases } = state;
  if (deployment.state !== "active") return "stopped";

  const liveLeases = leases.filter(isLeaseLive);
  if (liveLeases.length === 0) return "starting";

  const reports = liveLeases.flatMap(lease => (lease.status ? [lease.status] : []));
  if (reports.length < liveLeases.length) return undefined;

  return reports.every(({ services }) => hasEveryServiceUp(Object.values(services))) ? "ready" : "starting";
}

function hasEveryServiceUp(services: Array<{ available: number }>): boolean {
  return services.length > 0 && services.every(service => service.available > 0);
}
